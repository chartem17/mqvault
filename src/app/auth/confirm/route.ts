import { NextResponse } from "next/server";
import { siteOrigin } from "@/lib/auth/auth-api";
import { RECOVERY_COOKIE, RECOVERY_MAX_AGE_SECONDS, createRecoveryTicket } from "@/lib/auth/recovery-ticket";
import { safeNextPath } from "@/lib/auth/request-guard";
import { admitSession } from "@/lib/auth/sign-in";
import { createRouteAuthClient } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";
const TYPES = ["signup", "email", "recovery", "invite", "email_change"] as const;
type LinkType = typeof TYPES[number];

/** Marks this browser as returning from a reset e-mail, so /reset-password does not ask for the old password. */
async function withRecoveryTicket(response: NextResponse, userId: string) {
  response.cookies.set(RECOVERY_COOKIE, await createRecoveryTicket(process.env.SUPABASE_SECRET_KEY!, userId), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: RECOVERY_MAX_AGE_SECONDS,
  });
  return response;
}

/**
 * GET ?token_hash=…&type=signup|recovery|… — e-mail links that work in any browser (the e-mail templates
 * point here, see the runbook). The one-time token is verified by the Auth server; a recovery link always
 * lands on the new-password form.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = siteOrigin(request);
  const to = (path: string) => NextResponse.redirect(`${origin}${path}`, { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  const tokenHash = url.searchParams.get("token_hash");
  const type = TYPES.find(value => value === url.searchParams.get("type")) as LinkType | undefined;
  if (!tokenHash || tokenHash.length > 512 || !type) return to("/login?error=link");
  const client = await createRouteAuthClient();
  const { data, error } = await client.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error || !data.user) return to("/login?error=link");
  const admitted = await admitSession(client, data.user.id);
  if (!admitted.ok) return to(`/login?error=${admitted.reason}`);
  return type === "recovery" ? withRecoveryTicket(to("/reset-password"), data.user.id) : to(safeNextPath(url.searchParams.get("next")));
}
