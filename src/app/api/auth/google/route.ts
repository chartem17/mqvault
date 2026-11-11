import { NextResponse } from "next/server";
import { siteOrigin } from "@/lib/auth/auth-api";
import { safeNextPath } from "@/lib/auth/request-guard";
import { createRouteAuthClient } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

/** GET ?next=/path → redirects to Google. Off until the provider is configured (NEXT_PUBLIC_AUTH_GOOGLE=1, see the runbook). */
export async function GET(request: Request) {
  const origin = siteOrigin(request);
  const failed = NextResponse.redirect(`${origin}/login?error=provider`, { headers: { "Cache-Control": "no-store" } });
  if (process.env.NEXT_PUBLIC_AUTH_GOOGLE !== "1") return failed;
  const next = safeNextPath(new URL(request.url).searchParams.get("next"));
  const client = await createRouteAuthClient();
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`, skipBrowserRedirect: true },
  });
  if (error || !data.url) return failed;
  return NextResponse.redirect(data.url, { headers: { "Cache-Control": "no-store" } });
}
