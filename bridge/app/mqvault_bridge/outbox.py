"""Local queue (SQLite, WAL, synchronous=FULL): workers write what they read, the sender drains it in order (§5.2).

Nothing is lost while offline: an item leaves the queue only after the server answered 2xx.
"""
from __future__ import annotations

import hashlib
import json
import pathlib
import sqlite3
import time

SCHEMA = """
CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('heartbeat', 'deals')),
  account TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at REAL NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_at REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS dead (
  id INTEGER PRIMARY KEY, kind TEXT, account TEXT, payload TEXT, created_at REAL, failed_at REAL, status INTEGER
);
CREATE TABLE IF NOT EXISTS accounts (
  account TEXT PRIMARY KEY,
  full_done INTEGER NOT NULL DEFAULT 0,
  last_digest TEXT,
  week_starts TEXT,
  week_starts_at REAL NOT NULL DEFAULT 0
);
"""


def account_key(server: str, login: str) -> str:
    return f"{server}|{login}"


class Outbox:
    def __init__(self, path: pathlib.Path):
        self.db = sqlite3.connect(str(path), timeout=30, isolation_level=None)
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute("PRAGMA synchronous=FULL")
        self.db.executescript(SCHEMA)

    def close(self) -> None:
        self.db.close()

    # ---- producers (workers) ----
    def put_heartbeat(self, account: str, payload: dict) -> None:
        """At most one pending heartbeat per account; a newer one replaces it in place (keeps its queue position)."""
        text = json.dumps(payload, separators=(",", ":"))
        with self.db:
            updated = self.db.execute("UPDATE outbox SET payload = ? WHERE kind = 'heartbeat' AND account = ?", (text, account)).rowcount
            if not updated:
                self.db.execute("INSERT INTO outbox (kind, account, payload, created_at) VALUES ('heartbeat', ?, ?, ?)", (account, text, time.time()))

    def put_deals(self, account: str, batches: list[dict]) -> int:
        """Queues deal batches unless exactly the same window was queued last time. Returns how many were queued."""
        texts = [json.dumps(batch, separators=(",", ":"), sort_keys=True) for batch in batches]
        digest = hashlib.sha256("\n".join(texts).encode("utf-8")).hexdigest()
        with self.db:
            row = self.db.execute("SELECT last_digest FROM accounts WHERE account = ?", (account,)).fetchone()
            if row and row[0] == digest:
                return 0
            now = time.time()
            self.db.executemany("INSERT INTO outbox (kind, account, payload, created_at) VALUES ('deals', ?, ?, ?)", [(account, text, now) for text in texts])
            self.db.execute("INSERT INTO accounts (account, last_digest) VALUES (?, ?) ON CONFLICT(account) DO UPDATE SET last_digest = excluded.last_digest", (account, digest))
        return len(texts)

    def account_state(self, account: str) -> dict:
        row = self.db.execute("SELECT full_done, week_starts, week_starts_at FROM accounts WHERE account = ?", (account,)).fetchone()
        if not row:
            return {"full_done": False, "week_starts": None, "week_starts_at": 0.0}
        return {"full_done": bool(row[0]), "week_starts": json.loads(row[1]) if row[1] else None, "week_starts_at": row[2]}

    def mark_full_done(self, account: str) -> None:
        with self.db:
            self.db.execute("INSERT INTO accounts (account, full_done) VALUES (?, 1) ON CONFLICT(account) DO UPDATE SET full_done = 1", (account,))

    def save_week_starts(self, account: str, starts: list[int]) -> None:
        with self.db:
            self.db.execute(
                "INSERT INTO accounts (account, week_starts, week_starts_at) VALUES (?, ?, ?) ON CONFLICT(account) DO UPDATE SET week_starts = excluded.week_starts, week_starts_at = excluded.week_starts_at",
                (account, json.dumps(starts), time.time()),
            )

    # ---- consumer (sender) ----
    def next_ready(self) -> tuple[int, str, str, str] | None:
        """Oldest item whose retry time has come. Strict order: a waiting item blocks later ones (heartbeat before deals)."""
        row = self.db.execute("SELECT id, kind, account, payload, next_at FROM outbox ORDER BY id LIMIT 1").fetchone()
        if not row or row[4] > time.time():
            return None
        return row[0], row[1], row[2], row[3]

    def done(self, item_id: int) -> None:
        with self.db:
            self.db.execute("DELETE FROM outbox WHERE id = ?", (item_id,))

    def attempts(self, item_id: int) -> int:
        row = self.db.execute("SELECT attempts FROM outbox WHERE id = ?", (item_id,)).fetchone()
        return row[0] if row else 0

    def retry(self, item_id: int, delay: float) -> int:
        with self.db:
            self.db.execute("UPDATE outbox SET attempts = attempts + 1, next_at = ? WHERE id = ?", (time.time() + delay, item_id))
            return self.db.execute("SELECT attempts FROM outbox WHERE id = ?", (item_id,)).fetchone()[0]

    def bury(self, item_id: int, status: int) -> None:
        """A request the server refused as invalid would fail forever: keep it aside for diagnostics, move on."""
        with self.db:
            self.db.execute("INSERT INTO dead SELECT id, kind, account, payload, created_at, ?, ? FROM outbox WHERE id = ?", (time.time(), status, item_id))
            self.db.execute("DELETE FROM outbox WHERE id = ?", (item_id,))

    def pending(self) -> int:
        return self.db.execute("SELECT count(*) FROM outbox").fetchone()[0]
