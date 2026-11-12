import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/auth/audit";
import { resolveUser } from "@/lib/auth/current-user";
import { createRouteAuthClient } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * GET → the caller's active sign-in sessions (Settings → Security). Reads auth.sessions through
 * `list_auth_sessions`, a service-role-only function from migration 20261111190319. Until that migration is
 * applied the list is reported as unavailable instead of failing the page.
 */
export async function GET(request: Request) {
  const context = await resolveUser(request);
  if (context instanceof Response) return context;
  const { data: row } = await context.db.from("app_users").select("auth_user_id").eq("id", context.ownerId).maybeSingle();
  if (!row?.auth_user_id) return json({ sessions: [], available: false });
  const { data, error } = await context.admin.rpc("list_auth_sessions", { p_auth_user_id: row.auth_user_id });
  if (error) return json({ sessions: [], available: false });
  return json({ sessions: data ?? [], available: true });
}

/** POST { scope: "others" | "global" } — signs out every other device, or every device including this one. */
export async function POST(request: Request) {
  const context = await resolveUser(request);
  if (context instanceof Response) return context;
  const body = await request.json().catch(() => null) as { scope?: unknown } | null;
  const scope = body?.scope === "global" ? "global" : "others";
  const auth = await createRouteAuthClient();
  const { error } = await auth.auth.signOut({ scope });
  if (error) return json({ error: "Could not sign out" }, 502);
  await recordAudit(request, { userId: context.ownerId }, "sign_out_everywhere", { detail: { scope } });
  return json({ ok: true, scope });
}
