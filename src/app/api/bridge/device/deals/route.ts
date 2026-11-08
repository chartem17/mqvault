import { authenticateDevice, json, parseJson, syncPositions } from "@/lib/bridge/server";
import { parseDealsBatch } from "@/lib/bridge/device-payload";
import { terminalAccountState } from "@/lib/bridge/account-match";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST { account: { server, login }, deals: [...≤1000], orders: [...] } → { status, stored, inserted, updated }
 * Idempotent: repeats and overlapping windows are absorbed by the primary keys. The account must have been
 * announced by a heartbeat first. Deals of an account the owner removed from the journal are not stored at all.
 */
export async function POST(request: Request) {
  const context = await authenticateDevice(request);
  if (context instanceof Response) return context;
  const { db, device, body } = context;
  const batch = parseDealsBatch(parseJson(body));
  if (!batch) return json({ error: "invalid_request" }, 400);

  const { data: terminal } = await db.from("bridge_terminal_accounts").select("id, account_id, matched_at, ignored_at")
    .eq("user_id", device.user_id).eq("server", batch.account.server).eq("login", batch.account.login).maybeSingle();
  if (!terminal) return json({ error: "unknown_account" }, 409);
  const state = terminalAccountState(terminal);
  if (state === "ignored") return json({ status: "ignored", stored: 0 });

  const deals = batch.deals.map(deal => ({
    terminal_account_id: terminal.id, deal_ticket: deal.ticket, order_ticket: deal.order, position_id: deal.position_id, time_msc: deal.time_msc,
    type: deal.type, entry: deal.entry, symbol: deal.symbol, volume: deal.volume, price: deal.price, profit: deal.profit,
    commission: deal.commission, swap: deal.swap, fee: deal.fee, reason: deal.reason,
  }));
  const orders = batch.orders.map(order => ({
    terminal_account_id: terminal.id, order_ticket: order.ticket, position_id: order.position_id, time_setup_msc: order.time_setup_msc, sl: order.sl, tp: order.tp,
  }));
  if (deals.length) {
    const { error } = await db.from("bridge_deals").upsert(deals, { onConflict: "terminal_account_id,deal_ticket" });
    if (error) return json({ error: "unavailable" }, 503);
  }
  if (orders.length) {
    const { error } = await db.from("bridge_orders").upsert(orders, { onConflict: "terminal_account_id,order_ticket" });
    if (error) return json({ error: "unavailable" }, 503);
  }
  const now = new Date().toISOString();
  await db.from("bridge_devices").update({ last_sync_at: now }).eq("id", device.id);
  if (state !== "linked" || !terminal.account_id) return json({ status: "waiting", stored: deals.length });

  const positions = [...new Set([...batch.deals.map(deal => deal.position_id), ...batch.orders.map(order => order.position_id)].filter(id => id > 0))];
  try {
    const result = await syncPositions(db, { id: terminal.id, user_id: device.user_id, account_id: terminal.account_id }, positions);
    return json({ status: "linked", stored: deals.length, ...result });
  } catch {
    // Raw deals are saved (so the PC may drop them from its outbox); the next batch for these positions rebuilds the trades.
    return json({ status: "linked", stored: deals.length, error: "sync_failed" }, 202);
  }
}
