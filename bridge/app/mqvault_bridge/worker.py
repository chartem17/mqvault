"""Worker process for one terminal: read from MT5, write to the outbox. It has no network access and no device key."""
from __future__ import annotations

import logging
import pathlib
import time
from datetime import datetime, timedelta

from . import config
from .mt5_reader import Reader
from .outbox import Outbox, account_key

log = logging.getLogger("bridge.worker")


def batches(server: str, login: str, deals: list[dict], orders: list[dict], size: int = config.DEALS_PER_BATCH) -> list[dict]:
    """Deals sorted by time in chunks of `size`, each with the orders of its own positions only."""
    ordered = sorted(deals, key=lambda deal: (deal["time_msc"], deal["ticket"]))
    by_position: dict[int, list[dict]] = {}
    for order in orders:
        by_position.setdefault(order["position_id"], []).append(order)
    result = []
    for start in range(0, len(ordered), size):
        chunk = ordered[start:start + size]
        positions = {deal["position_id"] for deal in chunk if deal["position_id"]}
        chunk_orders = [order for position in sorted(positions) for order in by_position.get(position, [])][:2000]
        result.append({"account": {"server": server, "login": login}, "deals": chunk, "orders": chunk_orders})
    return result


def heartbeat_terminal(account: dict, week_starts: list[int] | None, offset: int | None) -> dict:
    return {**account, "server_offset_minutes": offset, "week_starts": week_starts or []}


def sync_once(reader: Reader, outbox: Outbox) -> str | None:
    """One pass: heartbeat, then deals (full history the first time, then the recent window). Returns the account key."""
    account = reader.account()
    if account is None:
        return None
    key = account_key(account["server"], account["login"])
    state = outbox.account_state(key)
    week_starts = state["week_starts"]
    if week_starts is None or time.time() - state["week_starts_at"] > config.WEEK_STARTS_SECONDS:
        week_starts = reader.week_starts()
        outbox.save_week_starts(key, week_starts)
    outbox.put_heartbeat(key, {"bridge_version": config.VERSION, "terminals": [heartbeat_terminal(account, week_starts, reader.live_offset())]})

    since = None if not state["full_done"] else datetime.now() - timedelta(days=config.RECENT_DAYS + 1)
    deals = reader.deals(since)
    orders = reader.orders(since)
    queued = outbox.put_deals(key, batches(account["server"], account["login"], deals, orders)) if deals else 0
    if not state["full_done"]:
        outbox.mark_full_done(key)
    if queued:
        log.info("queued %d deal batch(es)", queued)
    return key


def run(path: str, outbox_path: str, stop_flag) -> None:
    """Entry point of the worker process. Exits quietly when the terminal closes; the supervisor restarts it."""
    logging.basicConfig(filename=str(pathlib.Path(outbox_path).with_name("bridge.log")), level=logging.INFO, format="%(asctime)s %(process)d %(name)s %(message)s")
    reader = Reader(path)
    if not reader.attach():
        log.warning("attach failed: %s", reader.error()[0] if reader.error() else "?")
        return
    outbox = Outbox(pathlib.Path(outbox_path))
    try:
        while not stop_flag.is_set():
            if sync_once(reader, outbox) is None:
                return  # terminal closed or logged out
            stop_flag.wait(config.HEARTBEAT_SECONDS)
    finally:
        outbox.close()
        reader.detach()
