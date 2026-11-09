"""Small persistent state of the supervisor (device id, pairing in progress, replay counter, clock correction)."""
from __future__ import annotations

import json
import os
import pathlib
import threading
import time
from dataclasses import asdict, dataclass, field


@dataclass
class State:
    server: str | None = None
    device_id: str | None = None
    pairing_id: str | None = None
    pairing_code: str | None = None
    pairing_expires_at: str | None = None
    last_seq: int = 0
    clock_offset_ms: int = 0
    paused_until: float = 0.0
    extra: dict = field(default_factory=dict)


class StateFile:
    """Atomic JSON file; one writer (the supervisor). The counter is persisted before a request is sent."""

    def __init__(self, path: pathlib.Path):
        self.path = path
        self._lock = threading.Lock()
        self.state = self._load()

    def _load(self) -> State:
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
            known = {key: value for key, value in data.items() if key in State.__dataclass_fields__}
            return State(**known)
        except (FileNotFoundError, ValueError, TypeError):
            return State()

    def save(self) -> None:
        temporary = self.path.with_suffix(".tmp")
        temporary.write_text(json.dumps(asdict(self.state)), encoding="utf-8")
        os.replace(temporary, self.path)

    def now_ms(self) -> int:
        return int(time.time() * 1000) + self.state.clock_offset_ms

    def next_seq(self) -> int:
        """Strictly increasing even if the state file is lost: never below the current time in microseconds."""
        with self._lock:
            seq = max(self.state.last_seq + 1, int(time.time() * 1_000_000))
            self.state.last_seq = seq
            self.save()
            return seq
