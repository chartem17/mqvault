import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { guardRequest, safeNextPath, unauthenticatedResponse } from "@/lib/auth/request-guard";
import { SESSION_COOKIE_OPTIONS } from "@/lib/supabase/cookie-options";

/** DELETE on these collections is served by the deferred-deletion endpoint (ADR 0005). */
function deletionRewrite(request: NextRequest): URL | null {
  if (request.method !== "DELETE") return null;
  const kind = request.nextUrl.pathname === "/api/accounts" ? "account" : request.nextUrl.pathname === "/api/journal/trades" ? "trade" : null;
  if (!kind) return null;
  const destination = request.nextUrl.clone();
  destination.pathname = "/api/deletions";
  destination.searchParams.set("kind", kind);
  return destination;
}

export async function middleware(request: NextRequest) {
  const guard = guardRequest(request);
  if (guard.kind === "deny") return guard.response;
  const rewrite = deletionRewrite(request);
  const forward = () => (rewrite ? NextResponse.rewrite(rewrite, { request }) : NextResponse.next({ request }));
  if (guard.kind === "open" || guard.kind === "basic") return forward();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return new Response("Sign-in is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.", { status: 503, headers: { "Cache-Control": "no-store" } });

  // Refreshes an expiring session and hands the new cookies to both the route (request) and the browser (response).
  let response = forward();
  let signedIn = false;
  if (request.cookies.getAll().some(cookie => cookie.name.startsWith("sb-"))) {
    const supabase = createServerClient(url, key, {
      cookieOptions: SESSION_COOKIE_OPTIONS,
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: list => {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = forward();
          for (const { name, value, options } of list) response.cookies.set(name, value, { ...options, ...SESSION_COOKIE_OPTIONS });
        },
      },
    });
    // getUser asks the Auth server: a revoked session ("sign out everywhere") stops working on the next request.
    const { data } = await supabase.auth.getUser();
    signedIn = Boolean(data.user);
  }

  if (guard.kind === "session" && !signedIn) return unauthenticatedResponse(request);
  if (signedIn && request.nextUrl.pathname === "/login" && request.method === "GET" && !request.nextUrl.searchParams.has("step")) {
    return NextResponse.redirect(new URL(safeNextPath(request.nextUrl.searchParams.get("next")), request.url));
  }
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
