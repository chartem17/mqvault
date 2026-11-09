"""MQVaultBridge.exe / python -m mqvault_bridge

Packaged .exe: the first run installs itself for the current user and starts the installed copy; the installed copy
pairs (opens the confirmation page) and then syncs. `--uninstall` removes it. From source: `--server` for development.
"""
from __future__ import annotations

import argparse
import multiprocessing as mp
import sys
import threading

from . import config, installer, supervisor


def main() -> int:
    parser = argparse.ArgumentParser(prog="mqvault-bridge")
    parser.add_argument("--server", default=config.DEFAULT_SERVER)
    parser.add_argument("--no-browser", action="store_true", help="print the pairing link instead of opening it")
    parser.add_argument("--uninstall", action="store_true")
    args, _unknown = parser.parse_known_args()
    exe = installer.running_exe()

    if args.uninstall:
        installer.uninstall()
        if exe:
            installer.message("MQVault Bridge was removed. Disconnect this computer on the site as well: MT5 Bridge → Disconnect.")
        return 0
    try:
        server = config.check_server(args.server or "")
    except ValueError as error:
        if exe:
            installer.message(f"Invalid server address: {error}", error=True)
        print(error, file=sys.stderr)
        return 2

    if exe and not installer.is_installed_copy(exe):
        lock = supervisor.single_instance()
        if lock is None:
            installer.message("MQVault Bridge is already running on this computer.")
            return 0
        try:
            installer.install(exe)
        except OSError as error:
            installer.message(f"Could not install MQVault Bridge: {error}", error=True)
            return 1
        finally:
            supervisor.release(lock)  # the installed copy takes the lock next
        installer.start_installed()
        installer.message("MQVault Bridge is installed and will start with Windows.\n\nA browser page opens in a moment: confirm this computer there. After that Bridge syncs your MetaTrader 5 trades on its own.")
        return 0

    def show_code(code: str, url: str) -> None:
        print(f"Pairing code: {code}\nConfirm on: {url}", flush=True)

    stop = threading.Event()
    try:
        return supervisor.run(server, show_code, stop, open_browser=not args.no_browser)
    except KeyboardInterrupt:
        stop.set()
        return 0


if __name__ == "__main__":
    mp.freeze_support()
    sys.exit(main())
