"""The only module that touches MetaTrader 5 — and only through the read functions in READ_ONLY.

Claims S1/S2 (docs/features/mt5-bridge.md §4.3): the trading API is never looked up, initialize() never receives
credentials, the terminal is never started (we attach to a running terminal64.exe) and Market Watch is never changed.
tests/test_readonly.py enforces this with an AST check over the whole package.
"""
from __future__ import annotations

import ctypes
import ctypes.wintypes as wt
import os
import time
from datetime import datetime, timedelta

READ_ONLY = (
    "initialize", "shutdown", "last_error", "terminal_info", "account_info", "history_deals_get", "history_orders_get",
    "symbols_get", "symbol_info_tick", "copy_rates_range", "TIMEFRAME_H1",
)
TERMINAL_EXES = ("terminal64.exe", "terminal.exe")
TRADE_MODES = {0: "demo", 1: "contest", 2: "real"}
FX_SYMBOLS = ("EURUSD", "GBPUSD", "AUDUSD", "USDJPY", "USDCAD", "AUDCAD", "USDCHF", "NZDUSD")
HISTORY_START = datetime(2000, 1, 1)


def running_terminals() -> list[str]:
    """Full paths of running MT5 terminals of this Windows session (Win32 API, no extra dependencies)."""
    psapi, kernel32 = ctypes.WinDLL("psapi"), ctypes.WinDLL("kernel32")
    pids = (wt.DWORD * 4096)()
    needed = wt.DWORD()
    if not psapi.EnumProcesses(ctypes.byref(pids), ctypes.sizeof(pids), ctypes.byref(needed)):
        return []
    paths: set[str] = set()
    for pid in pids[: needed.value // ctypes.sizeof(wt.DWORD)]:
        handle = kernel32.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
        if not handle:
            continue
        try:
            buffer = ctypes.create_unicode_buffer(1024)
            size = wt.DWORD(len(buffer))
            if kernel32.QueryFullProcessImageNameW(handle, 0, buffer, ctypes.byref(size)):
                if os.path.basename(buffer.value).lower() in TERMINAL_EXES:
                    paths.add(buffer.value)
        finally:
            kernel32.CloseHandle(handle)
    return sorted(paths)


def deal_row(deal) -> dict:
    """Exactly the fields the server accepts (§3.5). No comment (owner's decision), no magic, no external id."""
    return {
        "ticket": int(deal.ticket), "order": int(deal.order), "position_id": int(deal.position_id), "time_msc": int(deal.time_msc),
        "type": int(deal.type), "entry": int(deal.entry), "symbol": str(deal.symbol)[:40], "volume": float(deal.volume),
        "price": float(deal.price), "profit": float(deal.profit), "commission": float(deal.commission), "swap": float(deal.swap),
        "fee": float(getattr(deal, "fee", 0.0)), "reason": int(deal.reason),
    }


def order_row(order) -> dict:
    return {"ticket": int(order.ticket), "position_id": int(order.position_id), "time_setup_msc": int(order.time_setup_msc), "sl": float(order.sl), "tp": float(order.tp)}


def week_starts_ms(bar_times: list[int]) -> list[int]:
    """First H1 bar after each gap of more than a day = the forex week open, in server-clock milliseconds."""
    return [t * 1000 for prev, t in zip(bar_times, bar_times[1:]) if t - prev > 24 * 3600]


def live_offset_minutes(tick_time: int, now: float) -> int | None:
    """Server offset from a fresh tick: valid only within ±2 min of a whole half-hour (a stale tick gives None)."""
    raw = (tick_time - now) / 60
    rounded = int(round(raw / 30) * 30)
    return rounded if abs(raw - rounded) <= 2 and abs(rounded) <= 14 * 60 else None


class Reader:
    """One attached terminal. The API allows a single terminal per process, so each worker process owns one Reader."""

    def __init__(self, path: str):
        import MetaTrader5 as raw

        self.path = path
        self._api = {name: getattr(raw, name) for name in READ_ONLY}

    def attach(self) -> bool:
        return bool(self._api["initialize"](path=self.path, timeout=15000))  # no login/server: the logged-in session

    def detach(self) -> None:
        self._api["shutdown"]()

    def error(self) -> tuple:
        return tuple(self._api["last_error"]())

    def account(self) -> dict | None:
        info = self._api["account_info"]()
        if info is None:
            return None
        # account_info().name (the owner's full name) is deliberately never read into the payload (§3.5).
        return {
            "server": str(info.server)[:64], "login": str(int(info.login)), "company": (str(info.company)[:120] or None),
            "trade_mode": TRADE_MODES.get(int(info.trade_mode), "real"), "currency": (str(info.currency) or None),
            "balance": float(info.balance), "equity": float(info.equity),
        }

    def deals(self, since: datetime | None) -> list[dict]:
        rows = self._api["history_deals_get"](since or HISTORY_START, datetime.now() + timedelta(days=2))
        return [deal_row(deal) for deal in (rows or ())]

    def orders(self, since: datetime | None) -> list[dict]:
        rows = self._api["history_orders_get"](since or HISTORY_START, datetime.now() + timedelta(days=2))
        return [order_row(order) for order in (rows or ())]

    def _visible(self) -> list[str]:
        return [info.name for info in (self._api["symbols_get"]() or ()) if info.visible]

    def week_starts(self) -> list[int]:
        """Weekly first bars of one visible forex symbol (only visible symbols: Market Watch is never changed)."""
        symbol = next((name for name in self._visible() if name.upper()[:6] in FX_SYMBOLS), None)
        if not symbol:
            return []
        rates = self._api["copy_rates_range"](symbol, self._api["TIMEFRAME_H1"], datetime.now() - timedelta(days=400), datetime.now() + timedelta(days=1))
        times = [int(rate["time"]) for rate in (rates if rates is not None else ())]
        return week_starts_ms(times)[-52:]

    def live_offset(self) -> int | None:
        best = None
        for symbol in self._visible()[:50]:
            tick = self._api["symbol_info_tick"](symbol)
            if tick is not None and tick.time and (best is None or tick.time > best):
                best = int(tick.time)
        return None if best is None else live_offset_minutes(best, time.time())
