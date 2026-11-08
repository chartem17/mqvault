/**
 * MQVault Bridge request signatures (ADR 0015, features/mt5-bridge.md §3.4).
 *
 * Every device request carries X-MQV-Device / X-MQV-Seq / X-MQV-Time / X-MQV-Sig. The signature is
 * ECDSA P-256 / SHA-256 over the canonical string
 *   mqv-bridge-v1\n<METHOD>\n<path>\n<time>\n<seq>\n<sha256(body) hex>
 * made with the device's private key, which never leaves the PC. The server keeps only the public key.
 * Replay protection (seq strictly increasing) is enforced atomically in the database, not here.
 *
 * Pure Web Crypto: runs in Node 20+, the Edge runtime and the browser; no React, no "@/" imports.
 */

export const SIGNATURE_VERSION = "mqv-bridge-v1";
/** Allowed difference between the device clock and the server clock. */
export const MAX_CLOCK_SKEW_MS = 5 * 60_000;
/** Largest request body a device may send (one batch of ≤ 1000 deals fits easily). */
export const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_PUBLIC_KEY_CHARS = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SignedHeaders = { device: string; seq: number; time: number; signature: Uint8Array };
export type HeaderError = "missing" | "malformed";

function base64ToBytes(value: string): Uint8Array | null {
  const clean = value.replace(/-/g, "+").replace(/_/g, "/").replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean) || clean.length === 0) return null;
  try {
    const binary = atob(clean.padEnd(Math.ceil(clean.length / 4) * 4, "="));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch { return null; }
}

function hex(bytes: ArrayBuffer | Uint8Array): string {
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  return hex(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
}

export function canonicalString(method: string, path: string, time: number, seq: number, bodySha256Hex: string): string {
  return [SIGNATURE_VERSION, method.toUpperCase(), path, String(time), String(seq), bodySha256Hex].join("\n");
}

/** Parses the four signature headers. Values outside strict formats are rejected before any crypto runs. */
export function parseSignedHeaders(get: (name: string) => string | null): SignedHeaders | HeaderError {
  const device = get("x-mqv-device"), seq = get("x-mqv-seq"), time = get("x-mqv-time"), sig = get("x-mqv-sig");
  if (!device || !seq || !time || !sig) return "missing";
  if (!UUID.test(device) || !/^[1-9]\d{0,15}$/.test(seq) || !/^\d{13}$/.test(time) || sig.length > 200) return "malformed";
  const signature = base64ToBytes(sig);
  const seqNumber = Number(seq);
  if (!signature || !Number.isSafeInteger(seqNumber)) return "malformed";
  return { device: device.toLowerCase(), seq: seqNumber, time: Number(time), signature };
}

export function clockSkewOk(time: number, now: number): boolean {
  return Math.abs(now - time) <= MAX_CLOCK_SKEW_MS;
}

/**
 * DER (what most libraries, incl. Python `cryptography`, emit) → IEEE P1363 r‖s (what Web Crypto verifies).
 * A 64-byte input is taken as P1363 already. Returns null for anything that is not a well-formed P-256 signature.
 */
export function toP1363(signature: Uint8Array): Uint8Array | null {
  if (signature.length === 64) return signature;
  if (signature.length < 8 || signature.length > 72 || signature[0] !== 0x30 || signature[1] !== signature.length - 2) return null;
  const out = new Uint8Array(64);
  let offset = 2;
  for (let part = 0; part < 2; part++) {
    if (signature[offset] !== 0x02) return null;
    const length = signature[offset + 1];
    const start = offset + 2;
    if (length < 1 || length > 33 || start + length > signature.length) return null;
    let value = signature.subarray(start, start + length);
    if (value.length === 33) { if (value[0] !== 0) return null; value = value.subarray(1); }
    out.set(value, part * 32 + (32 - value.length));
    offset = start + length;
  }
  return offset === signature.length ? out : null;
}

/** Imports a base64 SPKI P-256 public key. Null if it is not exactly that. */
export async function importPublicKey(spkiBase64: string): Promise<CryptoKey | null> {
  if (typeof spkiBase64 !== "string" || spkiBase64.length > MAX_PUBLIC_KEY_CHARS) return null;
  const bytes = base64ToBytes(spkiBase64);
  // A P-256 SPKI is 91 bytes (uncompressed point).
  if (!bytes || bytes.length !== 91) return null;
  try {
    return await crypto.subtle.importKey("spki", bytes as BufferSource, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  } catch { return null; }
}

/** Stable identifier of a public key: SHA-256 of its SPKI bytes, hex. */
export async function keyFingerprint(spkiBase64: string): Promise<string | null> {
  const bytes = base64ToBytes(spkiBase64);
  return bytes ? sha256Hex(bytes) : null;
}

export async function verifySignature(publicKeySpkiBase64: string, canonical: string, signature: Uint8Array): Promise<boolean> {
  const key = await importPublicKey(publicKeySpkiBase64);
  const raw = toP1363(signature);
  if (!key || !raw) return false;
  try {
    return await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, raw as BufferSource, new TextEncoder().encode(canonical));
  } catch { return false; }
}

/**
 * Paths a Bridge device calls without the owner's browser session. They are authenticated inside the route by a
 * device signature, so the private-access middleware lets them through (and only them: exact paths and methods).
 */
export function isDeviceSignedPath(pathname: string, method: string): boolean {
  const verb = method.toUpperCase();
  if (pathname === "/api/bridge/pairings") return verb === "POST";
  if (/^\/api\/bridge\/pairings\/[0-9a-f-]{36}$/i.test(pathname)) return verb === "GET";
  if (pathname === "/api/bridge/device/heartbeat" || pathname === "/api/bridge/device/deals") return verb === "POST";
  return false;
}
