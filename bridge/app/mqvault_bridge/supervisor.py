"""Supervisor: one per Windows session. Pairs the PC, watches for terminals, runs a worker per terminal, sends."""
from __future__ import annotations

import ctypes
import logging
import multiprocessing as mp
import threading
import time

from . import config, worker
from .api import Client
from .keystore import DeviceKey
from .mt5_reader import running_terminals
from .outbox import Outbox
from .pairing import ensure_paired
from .sender import Sender
from .state import StateFile

log = logging.getLogger("bridge.supervisor")


def single_instance() -> object | None:
    """Named mutex per user session; None if another Bridge already runs."""
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    handle = kernel32.CreateMutexW(None, False, "Local\\MQVaultBridge")
    if not handle or ctypes.get_last_error() == 183:  # ERROR_ALREADY_EXISTS
        return None
    return handle


class Workers:
    """Process per terminal path, restarted with exponential delay (1 s → 5 min) if it dies while the terminal runs."""

    def __init__(self, outbox_path: str):
        self.outbox_path = outbox_path
        self.context = mp.get_context("spawn")
        self.stop_flag = self.context.Event()
        self.procs: dict[str, mp.process.BaseProcess] = {}
        self.retry_at: dict[str, float] = {}
        self.failures: dict[str, int] = {}

    def tick(self, terminals: list[str]) -> None:
        now = time.time()
        for path in terminals:
            proc = self.procs.get(path)
            if proc is not None and proc.is_alive():
                continue
            if proc is not None:
                self.failures[path] = self.failures.get(path, 0) + 1
                self.retry_at[path] = now + min(300, 2 ** self.failures[path])
                del self.procs[path]
            if now < self.retry_at.get(path, 0):
                continue
            proc = self.context.Process(target=worker.run, args=(path, self.outbox_path, self.stop_flag), name="mt5-worker", daemon=True)
            proc.start()
            self.procs[path] = proc
        for path in [path for path in self.procs if path not in terminals]:
            self.procs.pop(path).join(timeout=5)  # terminal closed: worker exits by itself
            self.failures.pop(path, None)

    def shutdown(self) -> None:
        self.stop_flag.set()
        for proc in self.procs.values():
            proc.join(timeout=10)


def run(server: str, show_code, stop: threading.Event, open_browser: bool = True) -> int:
    home = config.app_dir()
    logging.basicConfig(filename=str(home / "bridge.log"), level=logging.INFO, format="%(asctime)s %(process)d %(name)s %(message)s")
    if single_instance() is None:
        log.info("another instance is running")
        return 2
    state = StateFile(home / "state.json")
    if state.state.server and state.state.server != server:
        log.warning("server changed; pairing again")
        state.state.device_id = state.state.pairing_id = None
    state.state.server = server
    state.save()
    client = Client(server, DeviceKey.load_or_create(home / "device.key"), state)
    if not ensure_paired(client, show_code, stop.is_set, open_browser):
        return 0

    outbox_path = home / "outbox.sqlite"
    Outbox(outbox_path).close()  # create the schema before any process uses the file
    sender = Sender(client, outbox_path, stop)
    sender.start()
    workers = Workers(str(outbox_path))
    log.info("running, version %s", config.VERSION)
    try:
        while not stop.is_set():
            if not sender.is_alive():  # never expected (the loop catches errors), but a dead sender would stop all syncing
                log.error("sender thread stopped; restarting")
                sender = Sender(client, outbox_path, stop)
                sender.start()
            workers.tick(running_terminals())
            stop.wait(config.TERMINAL_SCAN_SECONDS)
    finally:
        workers.shutdown()
    return 0
