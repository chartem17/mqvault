import { NextResponse } from "next/server";
import { resolveUser } from "@/lib/auth/current-user";
import { createRouteAuthClient } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Only https images from the sign-in provider are shown as the avatar. */
function avatarFrom(meta: Record<string, unknown>): string | null {
  const url = typeof meta.avatar_url === "string" ? meta.avatar_url : typeof meta.picture === "string" ? meta.picture : null;
  return url && url.startsWith("https://") && url.length <= 600 ? url : null;
}

/**
 * GET → profile of the signed-in user (ADR 0017): name, e-mail, role in the closed beta, counters, avatar and
 * sign-in methods from Supabase Auth. Every query is scoped by the verified `ownerId`.
 */
export async function GET(request: Request) {
  const context = await resolveUser(request);
  if (context instanceof Response) return context;
  const { db, ownerId } = context;
  const [row, accounts, trades] = await Promise.all([
    db.from("app_users").select("id, email, display_name, auth_user_id, created_at").eq("id", ownerId).maybeSingle(),
    db.from("accounts").select("id", { count: "exact", head: true }).eq("user_id", ownerId).eq("is_active", true),
    db.from("journal_trades").select("id", { count: "exact", head: true }).eq("user_id", ownerId),
  ]);
  if (row.error || !row.data) return json({ error: "Profile not found" }, 404);
  let avatar: string | null = null;
  let providers: string[] = [];
  let fallbackName: string | null = null;
  if (row.data.auth_user_id) {
    const { data } = await context.admin.auth.admin.getUserById(row.data.auth_user_id as string);
    const meta = (data?.user?.user_metadata ?? {}) as Record<string, unknown>;
    avatar = avatarFrom(meta);
    providers = (data?.user?.identities ?? []).map(identity => identity.provider);
    const name = typeof meta.full_name === "string" ? meta.full_name : typeof meta.name === "string" ? meta.name : "";
    fallbackName = name.trim().slice(0, 80) || null;
  }
  return json({
    profile: {
      id: row.data.id,
      email: row.data.email ?? context.email,
      display_name: (row.data.display_name as string | null) ?? fallbackName,
      avatar_url: avatar,
      plan: context.isOwner ? "owner" : "beta",
      created_at: row.data.created_at,
    },
    counters: { accounts: accounts.count ?? 0, trades: trades.count ?? 0 },
    hasPassword: providers.includes("email"),
    googleLinked: providers.includes("google"),
  });
}

/** PATCH { displayName } — the only profile field edited here. */
export async function PATCH(request: Request) {
  const context = await resolveUser(request);
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
    .eq("id", context.ownerId).select("display_name").maybeSingle();
  if (error || !data) return json({ error: "Could not save the name" }, 500);
  return json({ displayName: data.display_name });
}

/**
 * DELETE { confirm: "<email>" } — removes the workspace (app_users row; the existing FK cascades delete every
 * account, trade, strategy, layout and Bridge device) and then the Supabase Auth user. The installation owner
 * cannot delete itself here: that journal is the production data of the closed beta.
 */
export async function DELETE(request: Request) {
  const context = await resolveUser(request);
  if (context instanceof Response) return context;
  if (context.isOwner) return json({ error: "The installation owner cannot be deleted from the app" }, 403);
  const body = await request.json().catch(() => null) as { confirm?: unknown } | null;
  const expected = (context.email ?? "").trim().toLowerCase();
  if (!expected || typeof body?.confirm !== "string" || body.confirm.trim().toLowerCase() !== expected) {
    return json({ error: "Type your email to confirm deletion" }, 400);
  }
  const { data: row } = await context.db.from("app_users").select("auth_user_id").eq("id", context.ownerId).maybeSingle();
  // Users cannot delete their profile row through row-level security: removing a workspace is a server action.
  const { error } = await context.admin.from("app_users").delete().eq("id", context.ownerId).eq("is_owner", false);
  if (error) { console.error("Workspace deletion failed", error.code); return json({ error: "Could not delete the account" }, 500); }
  if (row?.auth_user_id) {
    const removed = await context.admin.auth.admin.deleteUser(row.auth_user_id as string);
    if (removed.error) console.error("Auth user deletion failed", removed.error.code ?? removed.error.status);
  }
  const auth = await createRouteAuthClient();
  await auth.auth.signOut({ scope: "local" }).catch(() => undefined);
  return json({ deleted: true });
}
