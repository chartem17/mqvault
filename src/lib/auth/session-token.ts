/** Stateless login session: `<expiresAtMs>.<hmac>`; derived from the access password, so changing the password logs everyone out. */
export const SESSION_COOKIE = "vault_session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const encoder = new TextEncoder();

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function sign(password: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(`vault-session-v1:${payload}`)));
}

/** Constant-time comparison of two strings via fixed-length digests. */
export async function safeEqual(actual: string, expected: string): Promise<boolean> {
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(actual)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index];
  return difference === 0;
}

export async function createSessionToken(password: string, now = Date.now()): Promise<string> {
  const expires = String(now + SESSION_MAX_AGE_SECONDS * 1000);
  return `${expires}.${await sign(password, expires)}`;
}

export async function verifySessionToken(password: string, token: string | undefined | null, now = Date.now()): Promise<boolean> {
  if (!token || token.length > 200) return false;
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const expires = token.slice(0, dot);
  if (!/^\d{10,16}$/.test(expires) || Number(expires) <= now) return false;
  return safeEqual(token.slice(dot + 1), await sign(password, expires));
}

/** Only same-site relative paths are allowed as a post-login destination. */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\") || value.startsWith("/login")) return "/";
  return value;
}
