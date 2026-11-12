import { NextRequest, NextResponse } from "next/server";
import type { CookieOptions } from "@supabase/ssr";
import { PUBLIC_PAGES, guardRequest, unauthenticatedResponse } from "@/lib/auth/request-guard";
import { authConfigured, createAuthClient, readSessionIdentity } from "@/lib/supabase/auth-server";
import { contentSecurityPolicy, createNonce } from "@/lib/security/headers";

/**
 * Every request passes here (ADR 0017): CSRF rule for writes, then a valid Supabase Auth session for
 * everything that is not explicitly public. Routes still resolve the user themselves (`resolveUser`) —
 * the middleware only answers "is somebody signed in", and keeps the session cookies fresh.
 */
export async function middleware(request: NextRequest) {
  // Content-Security-Policy with a fresh nonce on every response (package 3). Next.js reads the nonce from the
  // forwarded request header and tags its own scripts; the layout passes it to next-themes.
  const nonce = createNonce();
  const csp = contentSecurityPolicy(nonce, { dev: process.env.NODE_ENV === "development" });
  const response = await handle(request, nonce, csp);
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

async function handle(request: NextRequest, nonce: string, csp: string): Promise<Response> {
  /** Request headers for the page/route: the (refreshed) cookies plus the nonce. */
  const forwarded = () => {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("content-security-policy", csp);
    return { headers };
  };
  const guard = guardRequest(request);
  if (guard.access === "denied") return guard.response;
  if (guard.access === "machine") return NextResponse.next({ request: forwarded() });
  if (!authConfigured()) return new NextResponse("Sign-in is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.", { status: 503, headers: { "Cache-Control": "no-store" } });

  // Refreshed tokens must reach both the route (request cookies) and the browser (response cookies).
  const refreshed: { name: string; value: string; options: CookieOptions }[] = [];
  const auth = createAuthClient({
    getAll: () => request.cookies.getAll(),
    setAll: list => { for (const item of list) { request.cookies.set(item.name, item.value); refreshed.push(item); } },
  });
  const session = await readSessionIdentity(auth);
  const finish = (response: NextResponse) => {
    for (const { name, value, options } of refreshed) response.cookies.set(name, value, options);
    return response;
  };

  const { pathname } = request.nextUrl;
  if (guard.access === "public") {
    // A signed-in visitor has no business on the sign-in pages.
    if (session && PUBLIC_PAGES.has(pathname)) return finish(NextResponse.redirect(new URL("/", request.url)));
    return finish(NextResponse.next({ request: forwarded() }));
  }
  if (!session) {
    const denied = unauthenticatedResponse(request);
    return finish(new NextResponse(denied.body, { status: denied.status, headers: denied.headers }));
  }

  if (request.method === "DELETE") {
    const kind = pathname === "/api/accounts" ? "account" : pathname === "/api/journal/trades" ? "trade" : null;
    if (kind) {
      const destination = request.nextUrl.clone();
      destination.pathname = "/api/deletions";
      destination.searchParams.set("kind", kind);
      return finish(NextResponse.rewrite(destination, { request: forwarded() }));
    }
  }
  return finish(NextResponse.next({ request: forwarded() }));
}

// robots.txt is public: crawlers have no session. The Sentry tunnel carries error reports, also from signed-out pages.
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sentry-tunnel).*)"] };
