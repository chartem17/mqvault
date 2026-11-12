import { PASSWORD_PER_USER, authJson, rateLimited, readAuthBody } from "@/lib/auth/auth-api";
import { recordAudit } from "@/lib/auth/audit";
import { PASSWORD_MAX_LENGTH, passwordProblem } from "@/lib/auth/request-guard";
import { RECOVERY_COOKIE, verifyRecoveryTicket } from "@/lib/auth/recovery-ticket";
import { createRouteAuthClient } from "@/lib/supabase/auth-server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

/**
 * POST { password, current_password? } — sets a new password for the signed-in user.
 * Without the current password it works only in a session that was just opened from a reset e-mail, so a
 * borrowed browser session cannot be turned into a permanent takeover. Other devices are signed out afterwards.
 */
export async function POST(request: Request) {
  const client = await createRouteAuthClient();
  const { data: claimsData } = await client.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims || typeof claims.sub !== "string") return authJson({ error: "Authentication required" }, 401);
  const limited = await rateLimited(PASSWORD_PER_USER, claims.sub);
  if (limited) return limited;

  const body = await readAuthBody(request);
  const problem = passwordProblem(body?.password);
  if (problem) return authJson({ error: problem }, 400);

  const jar = await cookies();
  const fromResetLink = await verifyRecoveryTicket(process.env.SUPABASE_SECRET_KEY, jar.get(RECOVERY_COOKIE)?.value, claims.sub);
  if (!fromResetLink) {
    const current = typeof body?.current_password === "string" && body.current_password.length <= PASSWORD_MAX_LENGTH ? body.current_password : "";
    const email = typeof claims.email === "string" ? claims.email : "";
    if (!current || !email) return authJson({ error: "Enter your current password", code: "current_password_required" }, 403);
    const check = await client.auth.signInWithPassword({ email, password: current });
    if (check.error || check.data.user?.id !== claims.sub) return authJson({ error: "Current password is wrong" }, 403);
  }

  const { error } = await client.auth.updateUser({ password: body?.password as string });
  if (error) {
    if (error.code === "weak_password") return authJson({ error: "Choose a stronger password" }, 400);
    if (error.code === "same_password") return authJson({ error: "The new password must differ from the current one" }, 400);
    console.error("Password update failed", error.code ?? error.status);
    return authJson({ error: "Could not change the password. Try again later." }, 502);
  }
  jar.delete(RECOVERY_COOKIE);
  await client.auth.signOut({ scope: "others" }).catch(() => undefined);
  await recordAudit(request, { authUserId: claims.sub }, "password_changed", { method: fromResetLink ? "reset_link" : "current_password" });
  return authJson({ ok: true });
}
