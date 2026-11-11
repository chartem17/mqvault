import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/session";
import { createServiceSupabase } from "@/lib/supabase/server";
import { createSessionSupabase } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** GET → the signed-in user's profile, counters and linked sign-in methods. */
export async function GET(request: Request) {
  const context = await requireUser(request);
  if (context instanceof Response) return context;
  const { db, userId } = context;
  const [profile, accounts, trades, userResult] = await Promise.all([
    db.from("app_users").select("id, email, display_name, avatar_url, plan, timezone, locale, created_at").eq("id", userId).maybeSingle(),
    db.from("accounts").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_active", true),
    db.from("journal_trades").select("id", { count: "exact", head: true }).eq("user_id", userId),
    db.auth.getUser(),
  ]);
  if (profile.error || !profile.data) return json({ error: "Profile not found" }, 404);
  const identities = (userResult.data.user?.identities ?? []).map(identity => identity.provider);
  return json({
    profile: profile.data,
    counters: { accounts: accounts.count ?? 0, trades: trades.count ?? 0 },
    hasPassword: identities.includes("email"),
    googleLinked: identities.includes("google"),
  });
}

/** PATCH { displayName } — the only profile field edited here; RLS restricts the rest anyway. */
export async function PATCH(request: Request) {
  const context = await requireUser(request);
  if (context instanceof Response) return context;
  let name: string | null = null;
  try {
    const body = await request.json() as { displayName?: unknown };
    if (body.displayName !== null) {
      if (typeof body.displayName !== "string") return json({ error: "Invalid name" }, 400);
      name = body.displayName.trim().replace(/\s+/g, " ").slice(0, 80) || null;
    }
  } catch { return json({ error: "Invalid name" }, 400); }
  const { data, error } = await context.db.from("app_users")
    .update({ display_name: name, updated_at: new Date().toISOString() })
    .eq("id", context.userId).select("display_name").maybeSingle();
  if (error || !data) return json({ error: "Could not save the name" }, 500);
  return json({ displayName: data.display_name });
}

/**
 * DELETE { confirm: "<email>" } — deletes the account and every row that belongs to it (FK cascades from
 * auth.users → app_users → data). The service key is required for the Auth admin API (documented in ADR 0017).
 */
export async function DELETE(request: Request) {
  const context = await requireUser(request);
  if (context instanceof Response) return context;
  const body = await request.json().catch(() => null) as { confirm?: unknown } | null;
  const expected = (context.email ?? "").trim().toLowerCase();
  if (!expected || typeof body?.confirm !== "string" || body.confirm.trim().toLowerCase() !== expected) {
    return json({ error: "Type your email to confirm deletion" }, 400);
  }
  const { error } = await createServiceSupabase().auth.admin.deleteUser(context.userId);
  if (error) { console.error("Account deletion failed", { code: error.code }); return json({ error: "Could not delete the account" }, 500); }
  const session = await createSessionSupabase();
  await session.auth.signOut({ scope: "local" });
  return json({ deleted: true });
}
