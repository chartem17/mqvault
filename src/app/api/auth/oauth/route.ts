import { NextResponse } from "next/server";
import { siteOrigin } from "@/lib/auth/auth-api";
import { safeNextPath } from "@/lib/auth/request-guard";
import { clientIp, rateLimited } from "@/lib/auth/rate-limit";
import { createSessionSupabase } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

/** GET ?provider=google&next=/path → redirect to the provider. The return address is always our own /auth/callback. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = siteOrigin(request);
  const failed = NextResponse.redirect(new URL("/login?error=oauth", origin), { headers: { "Cache-Control": "no-store" } });
  if (url.searchParams.get("provider") !== "google") return failed;
  if (await rateLimited(`auth:oauth:${await clientIp(request)}`, 600, 30)) return failed;
  const next = safeNextPath(url.searchParams.get("next"));
  const db = await createSessionSupabase();
  const { data, error } = await db.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`, skipBrowserRedirect: true },
  });
  if (error || !data.url) return failed;
  return NextResponse.redirect(data.url, { headers: { "Cache-Control": "no-store" } });
}
