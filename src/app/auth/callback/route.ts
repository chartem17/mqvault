import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/auth/audit";
import { siteOrigin } from "@/lib/auth/auth-api";
import { RECOVERY_COOKIE, RECOVERY_MAX_AGE_SECONDS, createRecoveryTicket } from "@/lib/auth/recovery-ticket";
import { safeNextPath } from "@/lib/auth/request-guard";
import { admitSession } from "@/lib/auth/sign-in";
import { createRouteAuthClient } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

/** Marks this browser as returning from a reset e-mail, so /reset-password does not ask for the old password. */
async function withRecoveryTicket(response: NextResponse, userId: string) {
  response.cookies.set(RECOVERY_COOKIE, await createRecoveryTicket(process.env.SUPABASE_SECRET_KEY!, userId), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: RECOVERY_MAX_AGE_SECONDS,
  });
  return response;
}

/**
 * GET ?code=…&next=/path — the return leg of an e-mail link or Google sign-in (PKCE).
 * The code is useless without the verifier cookie set in the browser that started the flow.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = siteOrigin(request);
  const to = (path: string) => NextResponse.redirect(`${origin}${path}`, { headers: { "Cache-Control": "no-store" } });
  const code = url.searchParams.get("code");
  // The link was opened in another browser, expired or was used already. A sign-up is confirmed anyway at this point.
  if (!code || code.length > 512) return to("/login?error=link");
  const client = await createRouteAuthClient();
  const { data, error } = await client.auth.exchangeCodeForSession(code);
  if (error || !data.user) return to("/login?error=link");
  const admitted = await admitSession(client, data.user.id);
  if (!admitted.ok) return to(`/login?error=${admitted.reason}`);
  const provider = (data.user.app_metadata as { provider?: unknown } | undefined)?.provider;
  await recordAudit(request, { authUserId: data.user.id }, "sign_in", { method: provider === "google" ? "google" : "email_link" });
  const next = safeNextPath(url.searchParams.get("next"));
  // Completing this round trip proves control of the mailbox (or the linked Google identity) right now.
  return next === "/reset-password" ? withRecoveryTicket(to(next), data.user.id) : to(next);
}
