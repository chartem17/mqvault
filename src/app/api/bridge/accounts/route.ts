import { resolvePrivateOwner } from "@/lib/supabase/private-owner";
import { json } from "@/lib/bridge/server";
import { depositsTotal, parseReviewDecision } from "@/lib/bridge/account-match";

export const dynamic = "force-dynamic";

/**
 * GET → MT5 accounts the Bridge added that wait for the owner's answer on Home ("is it a prop account?"),
 * each with the suggested starting balance (sum of deposits).
 */
export async function GET(request: Request) {
  const context = await resolvePrivateOwner(request);
  if (context instanceof Response) return context;
  const { db, ownerId } = context;
  const { data, error } = await db.from("bridge_terminal_accounts")
    .select("id, server, login, company, trade_mode, currency, account_id")
    .eq("user_id", ownerId).eq("needs_review", true).is("ignored_at", null).not("account_id", "is", null).order("created_at");
  if (error) return json({ error: "Failed to load MT5 accounts" }, 500);
  const accounts = await Promise.all((data ?? []).map(async row => {
    const { data: deposits } = await db.from("bridge_deals").select("type, profit").eq("terminal_account_id", row.id).eq("type", 2).limit(1000);
    return { ...row, deposits: depositsTotal((deposits ?? []).map(deal => ({ type: Number(deal.type), profit: Number(deal.profit) }))) };
  }));
  return json({ accounts });
}

/** POST { id, decision: "confirm" | "ignore" } — confirm hides the question; ignore also stops syncing this MT5 account. */
export async function POST(request: Request) {
  const context = await resolvePrivateOwner(request);
  if (context instanceof Response) return context;
  const { db, ownerId } = context;
  const body = parseReviewDecision(await request.json().catch(() => null));
  if (!body) return json({ error: "Invalid request" }, 400);
  const patch = body.decision === "ignore" ? { needs_review: false, ignored_at: new Date().toISOString() } : { needs_review: false };
  const { data, error } = await db.from("bridge_terminal_accounts").update(patch).eq("id", body.id).eq("user_id", ownerId).select("id").maybeSingle();
  if (error) return json({ error: "Failed to save" }, 500);
  if (!data) return json({ error: "Unknown MT5 account" }, 404);
  return json({ ok: true });
}
