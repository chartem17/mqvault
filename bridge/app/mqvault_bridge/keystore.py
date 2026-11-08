"""Device key: ECDSA P-256, generated on this PC; the private key never leaves it (§3.3).

Stored as PKCS#8 encrypted with Windows DPAPI for the current user (CryptProtectData), so another Windows user or a
copied file on another PC cannot use it. TPM / CNG non-exportable keys are the next step (key_storage "tpm"/"cng").
"""
from __future__ import annotations

import base64
import ctypes
import ctypes.wintypes as wt
import os
import pathlib

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec

ENTROPY = b"mqvault-bridge-device-key-v1"


class _Blob(ctypes.Structure):
    _fields_ = [("cbData", wt.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]


def _blob(data: bytes) -> tuple[_Blob, ctypes.Array]:
    buffer = ctypes.create_string_buffer(data, len(data))
    return _Blob(len(data), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_char))), buffer


def _dpapi(data: bytes, protect: bool) -> bytes:
    crypt32, kernel32 = ctypes.WinDLL("crypt32"), ctypes.WinDLL("kernel32")
    source, _keep1 = _blob(data)
    entropy, _keep2 = _blob(ENTROPY)
    out = _Blob()
    flags = 0x1  # CRYPTPROTECT_UI_FORBIDDEN
    call = crypt32.CryptProtectData if protect else crypt32.CryptUnprotectData
    if not call(ctypes.byref(source), None, ctypes.byref(entropy), None, None, flags, ctypes.byref(out)):
        raise OSError("DPAPI failed")
    try:
        return ctypes.string_at(out.pbData, out.cbData)
    finally:
        kernel32.LocalFree(out.pbData)


class DeviceKey:
    storage = "dpapi"

    def __init__(self, private_key: ec.EllipticCurvePrivateKey):
        self._key = private_key

    @classmethod
    def load_or_create(cls, path: pathlib.Path) -> "DeviceKey":
        if path.exists():
            der = _dpapi(path.read_bytes(), protect=False)
            key = serialization.load_der_private_key(der, password=None)
            if not isinstance(key, ec.EllipticCurvePrivateKey) or key.curve.name != "secp256r1":
                raise ValueError("device key file is not a P-256 key")
            return cls(key)
        key = ec.generate_private_key(ec.SECP256R1())
        der = key.private_bytes(serialization.Encoding.DER, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
        temporary = path.with_suffix(".tmp")
        temporary.write_bytes(_dpapi(der, protect=True))
        os.replace(temporary, path)
        return cls(key)

    def public_spki_b64(self) -> str:
        der = self._key.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
        return base64.b64encode(der).decode("ascii")

    def sign(self, message: bytes) -> str:
        """DER ECDSA signature, base64 — the server accepts DER and raw r||s."""
        return base64.b64encode(self._key.sign(message, ec.ECDSA(hashes.SHA256()))).decode("ascii")
