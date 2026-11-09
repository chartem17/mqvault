"""First start: ask the server for a code, open the confirmation page, wait for the owner to approve (§3.2–3.3)."""
from __future__ import annotations

import logging
import platform
import time
import webbrowser
from datetime import datetime, timezone
from typing import Callable

from .api import Client
from .config import VERSION

log = logging.getLogger("bridge.pairing")
POLL_SECONDS = 5


def _expired(iso: str | None) -> bool:
    if not iso:
        return True
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00")) <= datetime.now(timezone.utc)
    except ValueError:
        return True


def device_label() -> str:
    """Shown to the owner on the confirmation page: computer name only (no Windows user name, nothing else)."""
    return (platform.node() or "Windows PC")[:80]


def ensure_paired(client: Client, show_code: Callable[[str, str], None], stop: Callable[[], bool], open_browser: bool = True) -> bool:
    """Blocks until this PC has a device id. Returns False if stopped first."""
    state = client.state
    while not state.state.device_id:
        if stop():
            return False
        if not state.state.pairing_id or _expired(state.state.pairing_expires_at):
            reply = client.post_unsigned("/api/bridge/pairings", {
                "public_key": client.key.public_spki_b64(), "device_name": device_label(),
                "os": f"Windows {platform.release()}"[:80], "bridge_version": VERSION, "key_storage": client.key.storage,
            })
            if reply.status != 201:
                log.warning("pairing request failed: %s %s", reply.status, reply.body.get("error"))
                time.sleep(30 if reply.status in (0, 429, 503) else 300)
                continue
            state.state.pairing_id, state.state.pairing_code, state.state.pairing_expires_at = reply.body["pairing_id"], reply.body["user_code"], reply.body["expires_at"]
            state.save()
            url = client.server + str(reply.body.get("verification_path", "/bridge/connect"))
            show_code(state.state.pairing_code, url)
            if open_browser:
                webbrowser.open(url)
        time.sleep(POLL_SECONDS)
        reply = client.signed("GET", f"/api/bridge/pairings/{state.state.pairing_id}", None, state.state.pairing_id)
        if reply.status == 200 and reply.body.get("status") == "approved" and reply.body.get("device_id"):
            state.state.device_id = str(reply.body["device_id"])
            state.state.pairing_id = state.state.pairing_code = state.state.pairing_expires_at = None
            state.save()
            log.info("paired")
            return True
        if reply.status == 200 and reply.body.get("status") == "expired":
            state.state.pairing_id = None
        elif reply.status == 401 and reply.body.get("error") == "clock_skew" and isinstance(reply.body.get("server_time"), int):
            state.state.clock_offset_ms = reply.body["server_time"] - int(time.time() * 1000)
            state.save()
    return True
