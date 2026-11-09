"""HTTPS client for /api/bridge/*. Outbound only; redirects are refused so signed headers never go elsewhere."""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from dataclasses import dataclass

from . import signing
from .config import VERSION
from .keystore import DeviceKey
from .state import StateFile


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):  # noqa: D401 - urllib hook
        return None


_opener = urllib.request.build_opener(_NoRedirect)


@dataclass
class Response:
    status: int
    body: dict


class Client:
    def __init__(self, server: str, key: DeviceKey, state: StateFile, timeout: float = 30):
        self.server, self.key, self.state, self.timeout = server, key, state, timeout

    def _send(self, method: str, path: str, body: bytes | None, headers: dict[str, str]) -> Response:
        request = urllib.request.Request(self.server + path, data=body, method=method, headers={
            "Content-Type": "application/json", "Accept": "application/json", "User-Agent": f"MQVaultBridge/{VERSION}", **headers,
        })
        try:
            with _opener.open(request, timeout=self.timeout) as reply:
                return Response(reply.status, _json(reply.read()))
        except urllib.error.HTTPError as error:
            return Response(error.code, _json(error.read()))
        except (urllib.error.URLError, TimeoutError, OSError):
            return Response(0, {"error": "network"})

    def post_unsigned(self, path: str, payload: dict) -> Response:
        return self._send("POST", path, _encode(payload), {})

    def signed(self, method: str, path: str, payload: dict | None, signer_id: str) -> Response:
        """Signs with the device key; `signer_id` is the device id, or the pairing id while pairing."""
        body = b"" if payload is None else _encode(payload)
        seq, time_ms = self.state.next_seq(), self.state.now_ms()
        signature = self.key.sign(signing.canonical(method, path, time_ms, seq, body))
        return self._send(method, path, body if payload is not None else None, signing.headers(signer_id, seq, time_ms, signature))


def _encode(payload: dict) -> bytes:
    return json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def _json(raw: bytes) -> dict:
    try:
        value = json.loads(raw.decode("utf-8")) if raw else {}
        return value if isinstance(value, dict) else {}
    except (ValueError, UnicodeDecodeError):
        return {}
