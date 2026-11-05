import { SESSION_COOKIE, safeEqual, verifySessionToken } from "./session-token";

const PUBLIC_PATHS = new Set(["/login", "/api/auth/login"]);

function cookieValue(request: Request, name: string): string | undefined {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index > 0 && part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return undefined;
}

export async function checkPrivateAccess(request: Request): Promise<Response | null> {
  const password = process.env.VAULT_ACCESS_PASSWORD;
  const headers = { "Cache-Control": "no-store" };
  if (!password || password.length < 20) {
    return new Response("Private workspace access is not configured. Set VAULT_ACCESS_PASSWORD (at least 20 characters).", { status: 503, headers });
  }
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const safeMethod = ["GET", "HEAD", "OPTIONS"].includes(method);

  if (!safeMethod) {
    try {
      const expected = new URL(process.env.VAULT_SITE_ORIGIN || request.url).origin;
      const origin = request.headers.get("origin");
      const contentType = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      if (!origin || new URL(origin).origin !== expected || contentType !== "application/json") {
        return new Response("Same-origin JSON requests are required", { status: 403, headers });
      }
    } catch { return new Response("Invalid request origin", { status: 403, headers }); }
  }

  if (PUBLIC_PATHS.has(url.pathname)) return null;

  let allowed = await verifySessionToken(password, cookieValue(request, SESSION_COOKIE));
  if (!allowed) {
    const authorization = request.headers.get("authorization") ?? "";
    if (authorization.length <= 4096 && authorization.startsWith("Basic ")) {
      let credentials = "";
      try { credentials = atob(authorization.slice(6)); } catch { credentials = ""; }
      allowed = await safeEqual(credentials, `owner:${password}`);
    }
  }
  if (allowed) return null;

  if ((method === "GET" || method === "HEAD") && !url.pathname.startsWith("/api/")) {
    const login = new URL("/login", request.url);
    if (url.pathname !== "/") login.searchParams.set("next", url.pathname + url.search);
    return new Response(null, { status: 307, headers: { ...headers, Location: login.toString() } });
  }
  return new Response("Authentication required", { status: 401, headers });
}
