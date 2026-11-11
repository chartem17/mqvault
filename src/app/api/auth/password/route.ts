import { createClient } from "@supabase/supabase-js";
import { json, readJson, tooMany } from "@/lib/auth/auth-api";
import { passwordProblem } from "@/lib/auth/request-guard";
import { clientIp, rateLimited } from "@/lib/auth/rate-limit";
import { requireUser } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";
/** A session opened by an e-mailed code may set a password without the old one for this long. */
const FRESH_CODE_SECONDS = 15 * 60;

/**
 * POST { password, current? } — sets the signed-in user's password.
 * The current password is required unless the session was just opened by an e-mailed code (password reset) or the
 * account has no password yet (Google-only).
 */
export async function POST(request: Request) {
  const context = await requireUser(request);
  if (context instanceof Response) return context;
  const body = await readJson(request);
  const problem = passwordProblem(body.password);
  if (problem) return json({ error: problem }, 400);
  if (await rateLimited(`auth:password:${context.userId}:${await clientIp(request)}`, 900, 8)) return tooMany();

  const { data: claimsData } = await context.db.auth.getClaims();
  const amr = Array.isArray(claimsData?.claims.amr) ? claimsData.claims.amr as { method?: string; timestamp?: number }[] : [];
  const now = Math.floor(Date.now() / 1000);
  const freshCode = amr.some(entry => (entry.method === "otp" || entry.method === "recovery") && typeof entry.timestamp === "number" && now - entry.timestamp <= FRESH_CODE_SECONDS);
  const { data: userData, error: userError } = await context.db.auth.getUser();
  if (userError || !userData.user) return json({ error: "Authentication required" }, 401);
  const hasPassword = (userData.user.identities ?? []).some(identity => identity.provider === "email");

  if (hasPassword && !freshCode) {
    const current = typeof body.current === "string" && body.current.length <= 512 ? body.current : "";
    const probe = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const check = current && userData.user.email ? await probe.auth.signInWithPassword({ email: userData.user.email, password: current }) : null;
    if (!check || check.error) return json({ error: "Current password is incorrect" }, 400);
    await probe.auth.signOut({ scope: "local" });
  }
  const { error } = await context.db.auth.updateUser({ password: body.password as string });
  if (error?.code === "same_password") return json({ error: "The new password must differ from the current one" }, 400);
  if (error?.code === "weak_password") return json({ error: "Password is too weak" }, 400);
  if (error) { console.error("Password update failed", { code: error.code }); return json({ error: "Could not change the password" }, 500); }
  return json({ ok: true });
}
