"""Locations and constants. Nothing here is read from the network."""
from __future__ import annotations

import os
import pathlib
from urllib.parse import urlsplit

from . import __version__

VERSION = __version__
#: Production site (Vercel). Development runs pass --server http://localhost:3000.
DEFAULT_SERVER = "https://mqvault.vercel.app"

HEARTBEAT_SECONDS = 60
TERMINAL_SCAN_SECONDS = 15
#: Re-read window after the first full sync: late or corrected deals still arrive (§5.2).
RECENT_DAYS = 7
#: Weekly first bars for the broker clock are refreshed this often.
WEEK_STARTS_SECONDS = 3600
DEALS_PER_BATCH = 1000


def app_dir() -> pathlib.Path:
    """%LOCALAPPDATA%\\MQVault\\Bridge — per-user, no admin rights needed."""
    base = os.environ.get("MQVAULT_BRIDGE_HOME") or os.path.join(os.environ.get("LOCALAPPDATA") or str(pathlib.Path.home()), "MQVault", "Bridge")
    path = pathlib.Path(base)
    path.mkdir(parents=True, exist_ok=True)
    return path


def check_server(url: str) -> str:
    """HTTPS only; plain HTTP is accepted for this PC itself (development). No credentials, query or fragment."""
    parts = urlsplit(url.strip())
    local = parts.hostname in ("localhost", "127.0.0.1", "::1")
    if parts.scheme not in ("https", "http") or (parts.scheme == "http" and not local):
        raise ValueError("server must be https:// (http:// only for localhost)")
    if not parts.hostname or parts.username or parts.password or parts.query or parts.fragment or parts.path not in ("", "/"):
        raise ValueError("server must be a bare origin like https://example.com")
    return f"{parts.scheme}://{parts.netloc}"
