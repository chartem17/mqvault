import { isDeviceSignedPath } from "../bridge/signature";

/**
 * First gate for every request (ADR 0017). Pure: it decides from the URL, method and headers only.
 * Who the user is gets established afterwards from the Supabase Auth session (middleware and `resolveUser`).
 */

/** Pages a signed-out visitor may open. Signed-in visitors are sent to the app instead. */
export const PUBLIC_PAGES = new Set(["/login", "/signup", "/forgot-password"]);
/** Sign-in endpoints: POST, same-origin JSON, no session yet. */
export const PUBLIC_API = new Set(["/api/auth/login", "/api/auth/signup", "/api/auth/reset", "/api/auth/logout"]);
/** GET handlers that finish an e-mail link or OAuth round trip and create the session themselves. */
export const PUBLIC_CALLBACKS = new Set(["/auth/confirm", "/auth/callback", "/api/auth/google"]);
/**
 * Machine endpoints that authenticate with their own bearer token instead of a user session
 * (ADR 0015). Only POST is let through here; the route itself rejects anything without the token.
 */
export const TOKEN_PATHS = new Set(["/api/economic-calendar/sync"]);

export type RequestGuard =
  | { access: "public" | "machine" | "session" }
  | { access: "denied"; response: Response };

const NO_STORE = { "Cache-Control": "no-store" };

export function guardRequest(request: Request): RequestGuard {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  if (method === "POST" && TOKEN_PATHS.has(url.pathname)) return { access: "machine" };
  // MQVault Bridge calls from a user's PC: no browser, no session. The route itself requires a valid device
  // signature (src/lib/bridge/server.ts), so only these exact paths and methods skip the session check.
  if (isDeviceSignedPath(url.pathname, method)) return { access: "machine" };

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    // CSRF: a browser cannot send a cross-site JSON request with a foreign Origin without CORS, which we never grant.
    try {
      const expected = new URL(process.env.VAULT_SITE_ORIGIN || request.url).origin;
      const origin = request.headers.get("origin");
      const contentType = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      if (!origin || new URL(origin).origin !== expected || contentType !== "application/json") {
        return { access: "denied", response: new Response("Same-origin JSON requests are required", { status: 403, headers: NO_STORE }) };
      }
    } catch { return { access: "denied", response: new Response("Invalid request origin", { status: 403, headers: NO_STORE }) }; }
    return { access: PUBLIC_API.has(url.pathname) ? "public" : "session" };
  }

  if (PUBLIC_PAGES.has(url.pathname) || PUBLIC_CALLBACKS.has(url.pathname)) return { access: "public" };
  return { access: "session" };
}

/** What a request without a valid session gets: pages go to the sign-in form (and back afterwards), APIs get 401. */
export function unauthenticatedResponse(request: Request): Response {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  if ((method === "GET" || method === "HEAD") && !url.pathname.startsWith("/api/")) {
    const login = new URL("/login", request.url);
    if (url.pathname !== "/") login.searchParams.set("next", url.pathname + url.search);
    return new Response(null, { status: 307, headers: { ...NO_STORE, Location: login.toString() } });
  }
  return new Response(JSON.stringify({ error: "Authentication required" }), { status: 401, headers: { ...NO_STORE, "Content-Type": "application/json" } });
}

/** Only same-site relative paths are allowed as a post-login destination. */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) return "/";
  const path = value.split(/[?#]/)[0];
  if (PUBLIC_PAGES.has(path) || PUBLIC_CALLBACKS.has(path)) return "/";
  return value;
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}$/;
/** Lower-cased, trimmed e-mail or null. Deliverability is proven by the confirmation link, not by this check. */
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL.test(email) ? email : null;
}

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 200;
/** Returns an English message (a dictionary key) when the password is not acceptable. */
export function passwordProblem(value: unknown): string | null {
  if (typeof value !== "string" || value.length < PASSWORD_MIN_LENGTH) return "Password must be at least 10 characters";
  if (value.length > PASSWORD_MAX_LENGTH) return "Password is too long";
  return null;
}
