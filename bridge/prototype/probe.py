"""Stage-0 prototype for MQVault Bridge (ADR 0015).

Answers, on a real PC, the questions the design depends on:
  1. Can we attach to an already running, logged-in MT5 terminal with no login/password and no terminal settings?
  2. Does it work for several terminals at once (one process per terminal)?
  3. What does the deal history look like (fields, counts, time range)?
  4. Can we measure the broker server clock offset?

Read-only by construction: only the functions in READ_ONLY are ever looked up on the MetaTrader5 module.
It never starts a terminal: it only attaches to terminal64.exe processes that are already running.
Output masks account numbers and money amounts so it can be pasted into an issue safely.

Usage:  python -I probe.py            (all running terminals)
        python -I probe.py --json     (machine-readable)
"""
from __future__ import annotations

import ctypes
import ctypes.wintypes as wt
import json
import multiprocessing as mp
import os
import sys
import time
from datetime import datetime, timedelta, timezone

READ_ONLY = ("initialize", "shutdown", "last_error", "version", "terminal_info", "account_info", "history_deals_get", "history_orders_get", "symbols_get", "symbol_info_tick", "copy_rates_range", "TIMEFRAME_H1")
TERMINAL_EXES = ("terminal64.exe", "terminal.exe")


# ---------- finding running terminals (Win32, no extra dependencies) ----------
def running_terminals() -> list[str]:
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


def mask(value: object) -> str:
    text = str(value)
    return "***" + text[-3:] if len(text) > 3 else "***"


# ---------- one worker process per terminal (the API allows one connection per process) ----------
def probe_terminal(path: str) -> dict:
    import MetaTrader5 as raw

    mt5 = {name: getattr(raw, name) for name in READ_ONLY}
    report: dict = {"path": path, "package_version": raw.__version__}
    started = time.perf_counter()
    ok = mt5["initialize"](path=path, timeout=15000)  # no login/password/server: attach to the logged-in session
    report["attach_ms"] = round((time.perf_counter() - started) * 1000)
    report["attached"] = bool(ok)
    if not ok:
        report["error"] = list(mt5["last_error"]())
        return report
    try:
        report["terminal_version"] = list(mt5["version"]() or [])
        terminal = mt5["terminal_info"]()
        if terminal:
            info = terminal._asdict()
            report["terminal"] = {key: info.get(key) for key in ("build", "connected", "trade_allowed", "tradeapi_disabled", "dlls_allowed", "community_account", "language")}
        account = mt5["account_info"]()
        if account is None:
            report["account"] = None
            report["account_error"] = list(mt5["last_error"]())
            return report
        acc = account._asdict()
        report["account"] = {
            "login": mask(acc.get("login")), "server": acc.get("server"), "company": acc.get("company"),
            "trade_mode": {0: "demo", 1: "contest", 2: "real"}.get(acc.get("trade_mode"), acc.get("trade_mode")),
            "currency": acc.get("currency"), "has_balance": acc.get("balance") is not None,
            "fields": sorted(acc.keys()),
        }

        started = time.perf_counter()
        deals = mt5["history_deals_get"](datetime(2000, 1, 1), datetime.now() + timedelta(days=2))
        report["history_ms"] = round((time.perf_counter() - started) * 1000)
        if deals is None:
            report["deals_error"] = list(mt5["last_error"]())
            deals = ()
        rows = [deal._asdict() for deal in deals]
        trading = [row for row in rows if row.get("type") in (0, 1)]  # buy/sell; balance/credit ops are other types
        report["deals"] = {
            "total": len(rows),
            "trading": len(trading),
            "positions": len({row["position_id"] for row in trading}),
            "by_entry": {name: sum(1 for row in trading if row.get("entry") == code) for code, name in ((0, "in"), (1, "out"), (2, "inout"), (3, "out_by"))},
            "non_trading_types": sorted({row.get("type") for row in rows} - {0, 1}),
            "first_server_time": datetime.fromtimestamp(rows[0]["time"], timezone.utc).isoformat() if rows else None,
            "last_server_time": datetime.fromtimestamp(rows[-1]["time"], timezone.utc).isoformat() if rows else None,
            "fields": sorted(rows[0].keys()) if rows else [],
            "has_time_msc": bool(rows and "time_msc" in rows[0]),
            "has_fee": bool(rows and "fee" in rows[0]),
            "with_comment": sum(1 for row in trading if row.get("comment")),
        }

        # Initial SL/TP live on orders, not on deals: needed for R.
        orders = mt5["history_orders_get"](datetime(2000, 1, 1), datetime.now() + timedelta(days=2)) or ()
        traded_positions = {row["position_id"] for row in trading}
        with_sl = {order.position_id for order in orders if order.position_id in traded_positions and order.sl}
        report["orders"] = {"total": len(orders), "positions_with_initial_sl": len(with_sl), "positions": len(traded_positions)}

        # Broker clock offset: freshest tick among symbols visible in Market Watch (hidden symbols have no ticks,
        # and adding them to Market Watch would change the terminal - the bridge never does that).
        visible = [info.name for info in (mt5["symbols_get"]() or ()) if info.visible]
        report["visible_symbols"] = len(visible)

        # Weekend-proof offset source (docs §9.3): server time of the first H1 bar of each forex week.
        # The forex week opens Sunday 17:00 New York, so the server converts these to an offset per week.
        fx = next((name for name in visible if name.upper()[:6] in ("EURUSD", "GBPUSD", "AUDUSD", "USDJPY", "AUDCAD", "USDCAD")), None)
        if fx:
            rates = mt5["copy_rates_range"](fx, mt5["TIMEFRAME_H1"], datetime.now() - timedelta(days=400), datetime.now() + timedelta(days=1))
            times = [int(rate["time"]) for rate in (rates if rates is not None else ())]
            starts = [t for prev, t in zip(times, times[1:]) if t - prev > 24 * 3600]
            report["week_starts"] = {
                "symbol": fx,
                "count": len(starts),
                "not_monday_midnight": sum(1 for t in starts if datetime.fromtimestamp(t, timezone.utc).strftime("%a %H:%M") != "Mon 00:00"),
                "last": [datetime.fromtimestamp(t, timezone.utc).strftime("%Y-%m-%d %a %H:%M") for t in starts[-4:]],
            }
        best = None
        for symbol in visible[:50]:
            tick = mt5["symbol_info_tick"](symbol)
            if tick is None or not tick.time:
                continue
            age_check = tick.time - time.time()
            if best is None or tick.time > best[1]:
                best = (symbol, tick.time, age_check)
        if best:
            raw_minutes = best[2] / 60
            rounded = int(round(raw_minutes / 30) * 30)
            # A fresh tick lands within ~2 minutes of a whole half-hour offset; a stale one (weekend, closed market) does not.
            valid = abs(raw_minutes - rounded) <= 2 and abs(rounded) <= 14 * 60
            report["server_offset"] = {
                "symbol": best[0],
                "raw_minutes": round(raw_minutes, 1),
                "rounded_minutes": rounded if valid else None,
                "valid": valid,
                "note": None if valid else "last tick is stale (market closed) - offset cannot be measured right now",
            }
        else:
            report["server_offset"] = None
    finally:
        mt5["shutdown"]()
    return report


def main() -> int:
    as_json = "--json" in sys.argv
    paths = running_terminals()
    result = {"checked_at": datetime.now(timezone.utc).isoformat(), "python": sys.version.split()[0], "terminals_running": len(paths), "results": []}
    if not paths:
        result["hint"] = "No running MT5 terminal. Open MetaTrader 5, log in to an account, then run again. The probe never starts a terminal itself."
    else:
        with mp.get_context("spawn").Pool(processes=len(paths)) as pool:
            result["results"] = pool.map(probe_terminal, paths)
    print(json.dumps(result, indent=None if as_json else 2, ensure_ascii=False, default=str))
    return 0 if all(item.get("attached") for item in result["results"]) and paths else 1


if __name__ == "__main__":
    sys.exit(main())
