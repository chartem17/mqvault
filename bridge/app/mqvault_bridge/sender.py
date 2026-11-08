"""Drains the outbox to the server, one request at a time (so the replay counter always increases in order)."""
from __future__ import annotations

import json
import logging
import pathlib
import random
import threading
import time

from .api import Client, Response
from .outbox import Outbox

log = logging.getLogger("bridge.sender")
PATHS = {"heartbeat": "/api/bridge/device/heartbeat", "deals": "/api/bridge/device/deals"}
MAX_BACKOFF = 300


def backoff(attempts: int) -> float:
    return min(MAX_BACKOFF, 2 ** min(attempts, 9)) * (0.5 + random.random() / 2)


def decide(reply: Response) -> str:
    """What to do with a reply: 'done', 'retry', 'clock', 'replay', 'later', 'revoked' or 'bury'. Never a command."""
    if 200 <= reply.status < 300:
        return "done"
    error = reply.body.get("error")
    if reply.status == 401 and error == "clock_skew":
        return "clock"
    if reply.status == 401:
        return "revoked"
    if reply.status == 409 and error == "replay":
        return "replay"
    if reply.status == 409 and error == "unknown_account":
        return "later"
    if reply.status in (400, 413):
        return "bury"
    return "retry"  # network (0), 429, 5xx


class Sender(threading.Thread):
    """The outbox connection is opened inside the thread: SQLite connections must stay in the thread that made them."""

    def __init__(self, client: Client, outbox_path: pathlib.Path, stop: threading.Event):
        super().__init__(name="sender", daemon=True)
        self.client, self.outbox_path, self.stop = client, outbox_path, stop
        self.outbox: Outbox | None = None
        self.last_ok: float | None = None
        self.status = "starting"

    def run(self) -> None:
        self.outbox = Outbox(self.outbox_path)
        try:
            while not self.stop.is_set():
                try:
                    self._step()
                except Exception:  # noqa: BLE001 - one bad item or a locked database must not stop syncing for good
                    log.exception("sender step failed")
                    self.status = "error"
                    self.stop.wait(5)
        finally:
            self.outbox.close()

    def _step(self) -> None:
        state = self.client.state
        if time.time() < state.state.paused_until:
            self.stop.wait(5)
            return
        item = self.outbox.next_ready()
        if item is None:
            self.stop.wait(2)
            return
        item_id, kind, _account, payload = item
        reply = self.client.signed("POST", PATHS[kind], json.loads(payload), state.state.device_id)
        action = decide(reply)
        if action == "done":
            self.outbox.done(item_id)
            self.last_ok, self.status = time.time(), "online"
        elif action == "clock":
            server_time = reply.body.get("server_time")
            if isinstance(server_time, int):
                state.state.clock_offset_ms = server_time - int(time.time() * 1000)
                state.save()
        elif action == "replay":
            state.state.last_seq += 1000
            state.save()
        elif action == "later":
            self.outbox.retry(item_id, 30)
        elif action == "revoked":
            # The owner disconnected this PC (or the key is unknown). Stop sending; never re-pair on our own.
            self.status = "revoked"
            state.state.paused_until = time.time() + 3600
            state.save()
            log.warning("device not accepted by the server; paused")
        elif action == "bury":
            self.outbox.bury(item_id, reply.status)
            log.warning("server rejected a %s item (%s); kept aside", kind, reply.status)
        else:
            attempts = self.outbox.retry(item_id, backoff(self.outbox.attempts(item_id)))
            self.status = "offline" if reply.status == 0 else "server_error"
            log.info("%s not sent (%s), attempt %d", kind, reply.status, attempts)
