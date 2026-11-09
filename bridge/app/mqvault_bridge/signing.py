"""Canonical request string — must match src/lib/bridge/signature.ts byte for byte (tests/vector.json checks both)."""
from __future__ import annotations

import hashlib

VERSION = "mqv-bridge-v1"


def canonical(method: str, path: str, time_ms: int, seq: int, body: bytes) -> bytes:
    digest = hashlib.sha256(body).hexdigest()
    return "\n".join([VERSION, method.upper(), path, str(time_ms), str(seq), digest]).encode("utf-8")


def headers(device_id: str, seq: int, time_ms: int, signature_b64: str) -> dict[str, str]:
    return {"X-MQV-Device": device_id, "X-MQV-Seq": str(seq), "X-MQV-Time": str(time_ms), "X-MQV-Sig": signature_b64}
