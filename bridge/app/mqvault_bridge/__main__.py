"""python -m mqvault_bridge [--server https://…] [--no-browser]

The installed app runs without arguments (the installer bakes the server address). --server is for development.
"""
from __future__ import annotations

import argparse
import multiprocessing as mp
import sys
import threading

from . import config, supervisor


def main() -> int:
    parser = argparse.ArgumentParser(prog="mqvault-bridge")
    parser.add_argument("--server", default=config.DEFAULT_SERVER)
    parser.add_argument("--no-browser", action="store_true", help="print the pairing link instead of opening it")
    args = parser.parse_args()
    if not args.server:
        print("No server address: pass --server https://your-mqvault-site", file=sys.stderr)
        return 2
    try:
        server = config.check_server(args.server)
    except ValueError as error:
        print(error, file=sys.stderr)
        return 2

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
