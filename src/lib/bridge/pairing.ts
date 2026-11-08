/**
 * Pairing a PC with the journal (RFC 8628-style device authorization; features/mt5-bridge.md §3.3).
 * The Bridge asks for a short code, the owner confirms it on the site while signed in, and only the
 * holder of the private key from the pairing request can collect the resulting device id.
 */

/** 32 symbols without look-alikes (no 0/O, 1/I). 8 symbols → 32⁸ ≈ 1.1·10¹² codes. */
export const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const CODE_LENGTH = 8;
export const PAIRING_TTL_MS = 10 * 60_000;
/** Failed confirmations allowed per owner before a lock-out of APPROVE_LOCK_MS. */
export const MAX_FAILED_APPROVALS = 5;
export const APPROVE_LOCK_MS = 15 * 60_000;
/** New pairing requests allowed per IP per hour (the endpoint is public). */
export const MAX_PAIRINGS_PER_IP_HOUR = 10;

/** "K7Q2M9XD" → "K7Q2-M9XD". `random` must be cryptographically secure; injectable for tests. */
export function generateUserCode(random: (bytes: Uint8Array) => Uint8Array = bytes => crypto.getRandomValues(bytes)): string {
  const alphabet = CODE_ALPHABET.length;
  const limit = 256 - (256 % alphabet); // rejection sampling keeps the distribution uniform
  let code = "";
  while (code.length < CODE_LENGTH) {
    for (const byte of random(new Uint8Array(16))) {
      if (byte < limit && code.length < CODE_LENGTH) code += CODE_ALPHABET[byte % alphabet];
    }
  }
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** What a person typed → canonical code without the dash, or null. Forgives case, spaces and dashes. */
export function normalizeUserCode(input: unknown): string | null {
  if (typeof input !== "string" || input.length > 32) return null;
  const code = input.toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== CODE_LENGTH) return null;
  for (const char of code) if (!CODE_ALPHABET.includes(char)) return null;
  return code;
}

export type PairingRequest = { public_key: string; device_name: string; os: string; bridge_version: string; key_storage: "tpm" | "cng" | "dpapi" | "unknown" };

const label = (value: unknown, max: number) => {
  if (typeof value !== "string") return null;
  // Printable text only: these strings are shown to the owner on the confirmation page.
  const clean = value.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, "").trim();
  return clean ? clean.slice(0, max) : null;
};

/** Strict shape of POST /api/bridge/pairings. The public key itself is checked by importPublicKey. */
export function parsePairingRequest(body: unknown): PairingRequest | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const row = body as Record<string, unknown>;
  const allowed = new Set(["public_key", "device_name", "os", "bridge_version", "key_storage"]);
  if (Object.keys(row).some(key => !allowed.has(key))) return null;
  const publicKey = typeof row.public_key === "string" && row.public_key.length <= 200 ? row.public_key : null;
  const deviceName = label(row.device_name, 80), os = label(row.os, 80);
  const version = typeof row.bridge_version === "string" && /^\d{1,4}\.\d{1,4}\.\d{1,6}$/.test(row.bridge_version) ? row.bridge_version : null;
  const storage = row.key_storage === undefined ? "unknown" : row.key_storage;
  if (!publicKey || !deviceName || !os || !version || (storage !== "tpm" && storage !== "cng" && storage !== "dpapi" && storage !== "unknown")) return null;
  return { public_key: publicKey, device_name: deviceName, os, bridge_version: version, key_storage: storage };
}

export type PairingState = { expires_at: string; approved_at: string | null; device_id: string | null; consumed_at: string | null };
export type PairingStatus = "pending" | "approved" | "expired" | "consumed";

export function pairingStatus(row: PairingState, now: number): PairingStatus {
  if (row.consumed_at) return "consumed";
  if (row.approved_at && row.device_id) return "approved";
  return Date.parse(row.expires_at) <= now ? "expired" : "pending";
}
