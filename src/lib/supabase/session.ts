/**
 * The signed-in user's database client (ADR 0017). Server only.
 * It carries the user's own JWT, so Postgres row-level security filters every query by auth.uid();
 * the explicit `.eq("user_id", userId)` in the routes is a second, independent filter.
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parseBasicCredentials } from "@/lib/auth/request-guard";
import { clientIp, rateLimited } from "@/lib/auth/rate-limit";
import { SESSION_COOKIE_OPTIONS } from "./cookie-options";


const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Cookie-bound client for route handlers and server components (reads and refreshes the session cookie). */
export async function createSessionSupabase(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(url(), anonKey(), {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll: () => store.getAll(),
      setAll: list => {
        // Server components cannot write cookies; the middleware has already refreshed the session there.
        try { for (const { name, value, options } of list) store.set(name, value, { ...options, ...SESSION_COOKIE_OPTIONS }); } catch { /* read-only context */ }
      },
    },
  });
}

export type UserContext = { db: SupabaseClient; userId: string; email: string | null };

const unauthorized = () => NextResponse.json({ error: "Authentication required" }, { status: 401, headers: { "Cache-Control": "no-store" } });

/**
 * The only way an API route learns who is calling. Never read a user id from the request body or query.
 * Browser: verified session cookie. Scripts: `Authorization: Basic email:password` of the same account
 * (signed in for this one request, nothing stored, rate limited).
 */
export async function requireUser(request: Request): Promise<UserContext | Response> {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Basic ")) {
    const credentials = parseBasicCredentials(authorization);
    if (!credentials) return unauthorized();
    if (await rateLimited(`basic:${await clientIp(request)}`, 600, 30)) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429, headers: { "Cache-Control": "no-store" } });
    const db = createClient(url(), anonKey(), { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data, error } = await db.auth.signInWithPassword(credentials);
    if (error || !data.user) return unauthorized();
    return { db, userId: data.user.id, email: data.user.email ?? null };
  }
  const db = await createSessionSupabase();
  // getClaims verifies the JWT signature (locally with asymmetric keys, otherwise by asking the Auth server).
  const { data, error } = await db.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub || claims.role !== "authenticated") return unauthorized();
  return { db, userId: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
}
