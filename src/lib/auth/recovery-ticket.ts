/**
 * Proof that this browser has just come back from a password-reset e-mail (ADR 0017): `<userId>.<expiresAtMs>.<hmac>`.
 * Kept in an httpOnly cookie for a few minutes; while it is valid the new password may be set without the old one.
 * Signed with a server-only secret, so a script on the page cannot forge it by writing a cookie of the same name.
 */
import { safeEqual } from "./safe-equal";

export const RECOVERY_COOKIE = "vault_recovery";
export const RECOVERY_MAX_AGE_SECONDS = 20 * 60;

const encoder = new TextEncoder();

async function sign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(`vault-recovery-v1:${payload}`)));
  return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function createRecoveryTicket(secret: string, userId: string, now = Date.now()): Promise<string> {
  const payload = `${userId}.${now + RECOVERY_MAX_AGE_SECONDS * 1000}`;
  return `${payload}.${await sign(secret, payload)}`;
}

export async function verifyRecoveryTicket(secret: string | undefined, ticket: string | undefined | null, userId: string, now = Date.now()): Promise<boolean> {
  if (!secret || secret.length < 20 || !ticket || ticket.length > 200) return false;
  const parts = ticket.split(".");
  if (parts.length !== 3) return false;
  const [subject, expires, mac] = parts;
  if (subject !== userId || !/^\d{10,16}$/.test(expires) || Number(expires) <= now) return false;
  return safeEqual(mac, await sign(secret, `${subject}.${expires}`));
}
