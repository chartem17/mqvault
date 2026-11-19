import { NextResponse } from "next/server";
import { resolveUser, type UserContext } from "@/lib/auth/current-user";
import { sanitizePlaybook, type PlaybookConfig } from "@/lib/playbook/config";
import { dayStatus, riskState, windowAt, type PlaybookTrade } from "@/lib/playbook/engine";
import { draftFromInput, gatePassed, matchPlans, pendingPlansToday, planFromRow, planGate, planRisk, planRR } from "@/lib/playbook/plans";
import { zonedParts } from "@/lib/time/timezone";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Postgres "undefined table": the trade_plans migration is not applied yet. */
const MISSING_TABLE = "42P01";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const unavailable = () => json({ error: "Trade plans are not available yet", available: false }, 503);
const TRADE_FIELDS = "id, account_id, symbol, direction, opened_at, closed_at, entry_price, stop_loss, take_profit, risk_percent, result_r, net_pnl";

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  const text = await request.text();
  if (text.length > 16384) return null;
  try { const body = JSON.parse(text); return body && typeof body === "object" && !Array.isArray(body) ? body : null; } catch { return null; }
}

async function playbookOf(context: UserContext): Promise<PlaybookConfig> {
  const { data } = await context.db.from("app_users").select("preferences").eq("id", context.ownerId).maybeSingle();
  const preferences = data?.preferences && typeof data.preferences === "object" ? data.preferences as Record<string, unknown> : {};
  return sanitizePlaybook(preferences.playbook);
}

/** GET → every plan of the signed-in user (newest first). */
export async function GET(request: Request) {
  const context = await resolveUser(request);
  if (context instanceof Response) return context;
  const { data, error } = await context.db.from("trade_plans").select("*").eq("user_id", context.ownerId).order("created_at", { ascending: false }).limit(1000);
  if (error?.code === MISSING_TABLE) return json({ plans: [], available: false });
  if (error) return json({ error: "Could not load trade plans" }, 500);
  return json({ plans: (data ?? []).map(planFromRow), available: true });
}

/**
 * POST { …plan draft } → the saved plan. The whole checklist runs again here with the server's clock,
 * the account's trades and plans and the stored playbook; a plan that does not pass is refused (422).
 */
export async function POST(request: Request) {
  const context = await resolveUser(request);
  if (context instanceof Response) return context;
  const { db, ownerId } = context;
  const body = await readBody(request);
  if (!body) return json({ error: "Invalid plan" }, 400);
  const draft = draftFromInput(body);
  if (!draft.account_id) return json({ error: "Choose an account" }, 400);
  const { data: account } = await db.from("accounts").select("id").eq("id", draft.account_id).eq("user_id", ownerId).maybeSingle();
  if (!account) return json({ error: "Unknown account_id" }, 400);

  const config = await playbookOf(context);
  const now = Date.now();
  const since = new Date(now - 2 * 86_400_000).toISOString();
  const [tradesRes, plansRes] = await Promise.all([
    db.from("journal_trades").select(`${TRADE_FIELDS}, meta`).eq("user_id", ownerId).eq("account_id", draft.account_id).order("opened_at", { ascending: false }).limit(1000),
    db.from("trade_plans").select("*").eq("user_id", ownerId).eq("account_id", draft.account_id).gte("created_at", since).limit(200),
  ]);
  if (plansRes.error?.code === MISSING_TABLE) return unavailable();
  if (tradesRes.error || plansRes.error) return json({ error: "Could not check the plan" }, 500);
  const trades: PlaybookTrade[] = (tradesRes.data ?? []).map(row => {
    const meta = row.meta && typeof row.meta === "object" ? row.meta as { bridge?: { close_reason?: unknown } } : {};
    return { ...row, close_reason: typeof meta.bridge?.close_reason === "string" ? meta.bridge.close_reason : null } as PlaybookTrade;
  });
  const plans = (plansRes.data ?? []).map(planFromRow);
  const match = matchPlans(plans, trades, config);
  const today = zonedParts(now, config.timezone).date;
  const pending = pendingPlansToday(plans, match, draft.account_id, today, iso => zonedParts(iso, config.timezone).date);
  const day = dayStatus(trades, pending, now, config);
  const risk = riskState(trades, config, now);
  const checks = planGate(draft, { now, day, risk, config });
  if (!gatePassed(checks)) return json({ error: "The checklist is not passed", failed: checks.filter(check => !check.ok).map(check => check.id) }, 422);

  const window = windowAt(now, config);
  const row = {
    user_id: ownerId, account_id: draft.account_id, symbol: draft.symbol, direction: draft.direction,
    at_desk: draft.at_desk, context: draft.context, poi_type: draft.poi_type, poi_note: draft.poi_note, poi_swept: draft.poi_swept,
    reaction: draft.reaction, bos_timeframe: draft.bos_timeframe, bos_body_close: draft.bos_body_close, limit_on_fvg: draft.limit_on_fvg, m3_refined: draft.m3_refined,
    entry: draft.entry, stop: draft.stop, target: draft.target, rr: planRR(draft.direction, draft.entry, draft.stop, draft.target),
    risk_pct: planRisk(draft, risk), risk_exception: draft.risk_exception, screenshot_url: draft.screenshot_url, reason: draft.reason,
    gate: { window: window.window?.id ?? null, local_time: window.time, entries: day.entries, losses: day.losses, risk_level: risk.level, rule_risk_pct: risk.riskPct },
  };
  const { data, error } = await db.from("trade_plans").insert(row).select("*").single();
  if (error?.code === MISSING_TABLE) return unavailable();
  if (error) return json({ error: "Could not save the plan" }, 500);
  return json({ plan: planFromRow(data) }, 201);
}

/** PATCH { id, status?: "cancelled", trade_id?: uuid | null } — a saved plan is never edited, only cancelled or linked. */
export async function PATCH(request: Request) {
  const context = await resolveUser(request);
  if (context instanceof Response) return context;
  const { db, ownerId } = context;
  const body = await readBody(request);
  if (!body || typeof body.id !== "string" || !UUID.test(body.id)) return json({ error: "Invalid plan id" }, 400);
  const { data: current, error: readError } = await db.from("trade_plans").select("id, account_id, status").eq("id", body.id).eq("user_id", ownerId).maybeSingle();
  if (readError?.code === MISSING_TABLE) return unavailable();
  if (readError) return json({ error: "Could not update the plan" }, 500);
  if (!current) return json({ error: "Plan not found" }, 404);
  const fields: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (body.status !== "cancelled") return json({ error: "A plan can only be cancelled" }, 400);
    fields.status = "cancelled";
    fields.trade_id = null;
  }
  if (body.trade_id !== undefined) {
    if (body.trade_id === null) fields.trade_id = null;
    else {
      if (typeof body.trade_id !== "string" || !UUID.test(body.trade_id)) return json({ error: "Invalid trade id" }, 400);
      if (current.status === "cancelled" || fields.status === "cancelled") return json({ error: "A cancelled plan cannot be linked" }, 400);
      const { data: trade } = await db.from("journal_trades").select("id").eq("id", body.trade_id).eq("user_id", ownerId).eq("account_id", current.account_id).maybeSingle();
      if (!trade) return json({ error: "Trade not found on this account" }, 400);
      fields.trade_id = body.trade_id;
    }
  }
  if (!Object.keys(fields).length) return json({ error: "Nothing to change" }, 400);
  const { data, error } = await db.from("trade_plans").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", body.id).eq("user_id", ownerId).select("*").maybeSingle();
  if (error) return json({ error: error.code === "23505" ? "This trade is already linked to another plan" : "Could not update the plan" }, error.code === "23505" ? 409 : 500);
  if (!data) return json({ error: "Plan not found" }, 404);
  return json({ plan: planFromRow(data) });
}

/** DELETE { id } — only a cancelled plan (a mistake); an active plan stays as the discipline record. */
export async function DELETE(request: Request) {
  const context = await resolveUser(request);
  if (context instanceof Response) return context;
  const body = await readBody(request);
  if (!body || typeof body.id !== "string" || !UUID.test(body.id)) return json({ error: "Invalid plan id" }, 400);
  const { data, error } = await context.db.from("trade_plans").delete().eq("id", body.id).eq("user_id", context.ownerId).eq("status", "cancelled").select("id");
  if (error?.code === MISSING_TABLE) return unavailable();
  if (error) return json({ error: "Could not delete the plan" }, 500);
  if (!data?.length) return json({ error: "Only a cancelled plan can be deleted" }, 400);
  return json({ success: true });
}
