/**
 * First gate for every request (ADR 0017), run by the middleware before any session work. Pure: no database, no
 * cookies — only the request line and headers, so it is unit-tested on its own.
 */
import { isDeviceSignedPath } from "../bridge/signature";

/** Pages and auth endpoints reachable without a session. Exact paths only. */
export const PUBLIC_PATHS = new Set([
  "/login", "/auth/callback",
  "/api/auth/login", "/api/auth/signup", "/api/auth/verify", "/api/auth/resend", "/api/auth/reset", "/api/auth/oauth",
]);
/**
 * Machine endpoints that authenticate with their own bearer token instead of a user session (ADR 0015).
 * Only POST is let through here; the route itself rejects anything without the token.
 */
export const TOKEN_PATHS = new Set(["/api/economic-calendar/sync"]);

export type Guard =
  /** Refused outright. */
  | { kind: "deny"; response: Response }
  /** No user session involved: token endpoint or device-signed Bridge call. */
  | { kind: "open" }
  /** Public auth page/endpoint; the session cookie is still refreshed when present. */
  | { kind: "public" }
  /** API call with Basic credentials (scripts): the route signs the user in itself. */
  | { kind: "basic" }
  /** A signed-in user is required. */
  | { kind: "session" };

const NO_STORE = { "Cache-Control": "no-store" };

export function guardRequest(request: Request): Guard {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const safeMethod = method === "GET" || method === "HEAD" || method === "OPTIONS";
  if (method === "POST" && TOKEN_PATHS.has(url.pathname)) return { kind: "open" };
  // MQVault Bridge calls from a user's PC: no browser, no session. The route itself requires a valid device
  // signature (src/lib/bridge/server.ts), so only these exact paths and methods skip the session check.
  if (isDeviceSignedPath(url.pathname, method)) return { kind: "open" };

  if (!safeMethod) {
    try {
      const expected = new URL(process.env.VAULT_SITE_ORIGIN || request.url).origin;
      const origin = request.headers.get("origin");
      const contentType = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      if (!origin || new URL(origin).origin !== expected || contentType !== "application/json") {
        return { kind: "deny", response: new Response("Same-origin JSON requests are required", { status: 403, headers: NO_STORE }) };
      }
    } catch { return { kind: "deny", response: new Response("Invalid request origin", { status: 403, headers: NO_STORE }) }; }
  }

  if (PUBLIC_PATHS.has(url.pathname)) return { kind: "public" };
  const authorization = request.headers.get("authorization") ?? "";
  if (url.pathname.startsWith("/api/") && authorization.startsWith("Basic ") && authorization.length <= 4096) return { kind: "basic" };
  return { kind: "session" };
}

/** What an unauthenticated caller gets: pages go to /login (with a way back), everything else is a plain 401. */
export function unauthenticatedResponse(request: Request): Response {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  if ((method === "GET" || method === "HEAD") && !url.pathname.startsWith("/api/")) {
    const login = new URL("/login", request.url);
    if (url.pathname !== "/") login.searchParams.set("next", url.pathname + url.search);
    return new Response(null, { status: 307, headers: { ...NO_STORE, Location: login.toString() } });
  }
  return new Response("Authentication required", { status: 401, headers: NO_STORE });
}

/** Only same-site relative paths are allowed as a post-login destination. */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || value.length > 2048 || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  for (let index = 0; index < value.length; index++) if (value.charCodeAt(index) < 32) return "/";
  if (value === "/login" || value.startsWith("/login?") || value.startsWith("/login/") || value.startsWith("/auth/") || value.startsWith("/api/")) return "/";
  return value;
}

export function isEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Decodes `Authorization: Basic` into email and password (the password may contain colons). */
export function parseBasicCredentials(header: string | null): { email: string; password: string } | null {
  if (!header || header.length > 4096 || !header.startsWith("Basic ")) return null;
  let decoded = "";
  try { decoded = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(atob(header.slice(6).trim()), char => char.charCodeAt(0))); } catch { return null; }
  const colon = decoded.indexOf(":");
  if (colon < 3) return null;
  const email = decoded.slice(0, colon).trim().toLowerCase();
  const password = decoded.slice(colon + 1);
  return isEmail(email) && password.length >= 1 && password.length <= 512 ? { email, password } : null;
}

/** Password rules shared by sign-up, reset and change. bcrypt reads at most 72 bytes. */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;
export function passwordProblem(value: unknown): string | null {
  if (typeof value !== "string" || value.length < PASSWORD_MIN) return "Password must be at least 8 characters";
  if (new TextEncoder().encode(value).length > PASSWORD_MAX) return "Password is too long";
  return null;
}

/** 0–4 for the strength meter: length and variety, capped for the obvious cases. A hint, not a security control. */
export function passwordStrength(value: string): 0 | 1 | 2 | 3 | 4 {
  if (!value) return 0;
  let score = 0;
  if (value.length >= PASSWORD_MIN) score += 1;
  if (value.length >= 12) score += 1;
  const kinds = [/\p{Ll}/u, /\p{Lu}/u, /\d/, /[^\p{L}\d]/u].filter(pattern => pattern.test(value)).length;
  if (kinds >= 2) score += 1;
  if (kinds >= 3 && value.length >= 10) score += 1;
  if (/^(.)\1+$/.test(value) || /^(?:password|qwerty|123456|111111|letmein)/i.test(value)) score = Math.min(score, 1);
  return Math.max(1, Math.min(4, score)) as 1 | 2 | 3 | 4;
}

/** Email one-time codes: digits only; the length follows the Supabase project setting (6 by default). */
export const OTP_LENGTH = 6;
export function normalizeOtp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\s+/g, "");
  return /^\d{6,10}$/.test(digits) ? digits : null;
}

const encoder = new TextEncoder();
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
