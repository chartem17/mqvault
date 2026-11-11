import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase Auth on the server only (ADR 0017). The browser never holds a Supabase client: sign-in, sign-up
 * and password changes go through /api/auth/*, and the session cookies are httpOnly, so page scripts cannot read them.
 * This client uses the publishable key and is for auth.* calls only — data access stays in createServerSupabase().
 */

type CookieWrite = { name: string; value: string; options: CookieOptions };
export type CookieJar = { getAll(): { name: string; value: string }[]; setAll(cookies: CookieWrite[]): void };

export function sessionCookieOptions(options: CookieOptions): CookieOptions {
  return { ...options, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" };
}

/** The browser-safe key; Supabase calls it "publishable" now and "anon" in older projects. */
const publicKey = () => process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const authConfigured = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && publicKey());

export function createAuthClient(jar: CookieJar) {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, publicKey()!, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: list => jar.setAll(list.map(item => ({ ...item, options: sessionCookieOptions(item.options) }))),
    },
  });
}

/** For route handlers and server components. */
export async function createRouteAuthClient() {
  const store = await cookies();
  return createAuthClient({
    getAll: () => store.getAll(),
    setAll: list => {
      // Server components cannot write cookies; the middleware has already refreshed the session for them.
      try { for (const { name, value, options } of list) store.set(name, value, options); } catch { /* read-only context */ }
    },
  });
}

export type SessionIdentity = { authUserId: string; email: string | null };

/** The verified identity of the current session, or null. The token signature is checked, never just decoded. */
export async function readSessionIdentity(client: ReturnType<typeof createAuthClient>): Promise<SessionIdentity | null> {
  try {
    const { data, error } = await client.auth.getClaims();
    const claims = data?.claims;
    if (error || !claims || typeof claims.sub !== "string" || claims.is_anonymous === true) return null;
    return { authUserId: claims.sub, email: typeof claims.email === "string" && claims.email ? claims.email.toLowerCase() : null };
  } catch { return null; }
}
