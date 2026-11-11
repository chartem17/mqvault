/**
 * Server side of the Bridge API: device authentication and journal synchronisation.
 * Server-only (service-key database client); not part of the unit-test build — the logic it calls is.
 */
import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/server";
import { derivedFinancials } from "@/lib/journal/trade-financials";
import { canonicalString, clockSkewOk, MAX_BODY_BYTES, parseSignedHeaders, sha256Hex, verifySignature } from "./signature";
import { buildTrades, type Mt5Deal, type Mt5Order } from "./deals-to-trades";
import { planSync, type JournalTradeRef, type PositionLink } from "./trade-sync";
import { depositsTotal } from "./account-match";

export type Db = ReturnType<typeof createServiceSupabase>;
export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
/** Every authentication failure looks the same to the caller. */
const denied = () => json({ error: "unauthorized" }, 401);

/** Reads the body with a hard size limit (Content-Length is only a hint). */
export async function readBody(request: Request): Promise<Uint8Array | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return null;
  const bytes = new Uint8Array(await request.arrayBuffer());
  return bytes.length > MAX_BODY_BYTES ? null : bytes;
}

export function parseJson(bytes: Uint8Array): unknown {
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { return undefined; }
}

/**
 * Verifies a request signed by `publicKey`, without the replay counter (used by pairing status polls, which are
 * read-only). Returns the body bytes, or a Response to send back.
 */
export async function verifySignedRequest(request: Request, publicKey: (id: string) => Promise<string | null>): Promise<{ id: string; seq: number; body: Uint8Array } | Response> {
  const headers = parseSignedHeaders(name => request.headers.get(name));
  if (typeof headers === "string") return denied();
  if (!clockSkewOk(headers.time, Date.now())) return json({ error: "clock_skew", server_time: Date.now() }, 401);
  const body = await readBody(request);
  if (!body) return json({ error: "too_large" }, 413);
  const key = await publicKey(headers.device);
  if (!key) return denied();
  const canonical = canonicalString(request.method, new URL(request.url).pathname, headers.time, headers.seq, await sha256Hex(body));
  if (!(await verifySignature(key, canonical, headers.signature))) return denied();
  return { id: headers.device, seq: headers.seq, body };
}

export type DeviceContext = { db: Db; device: { id: string; user_id: string }; body: Uint8Array };

/** Full device authentication (§3.4): known, not revoked, valid signature, fresh time, strictly increasing seq. */
export async function authenticateDevice(request: Request): Promise<DeviceContext | Response> {
  const db = createServiceSupabase();
  const verified = await verifySignedRequest(request, async id => {
    const { data } = await db.from("bridge_devices").select("public_key").eq("id", id).is("revoked_at", null).maybeSingle();
    return (data?.public_key as string | undefined) ?? null;
  });
  if (verified instanceof Response) return verified;
  // Atomic replay guard: only one request with a given seq (and only increasing ones) can pass.
  const { data, error } = await db.from("bridge_devices")
    .update({ last_seq: verified.seq, last_seen_at: new Date().toISOString() })
    .eq("id", verified.id).lt("last_seq", verified.seq).is("revoked_at", null)
    .select("id, user_id").maybeSingle();
  if (error) return json({ error: "unavailable" }, 503);
  if (!data) return json({ error: "replay" }, 409);
  return { db, device: { id: data.id as string, user_id: data.user_id as string }, body: verified.body };
}

const num = (value: unknown) => (value === null || value === undefined ? 0 : Number(value));

/** True when writing `patch` would change the stored row (numbers and instants compared by value). */
function differs(patch: Record<string, unknown>, current: Record<string, unknown>): boolean {
  return Object.entries(patch).some(([key, next]) => {
    const prev = current[key];
    if (next === null || prev === null || next === undefined || prev === undefined) return (next ?? null) !== (prev ?? null);
    if (typeof next === "number") return Number(prev) !== next;
    if (key === "opened_at" || key === "closed_at") return Date.parse(String(prev)) !== Date.parse(String(next));
    return String(prev) !== String(next);
  });
}

export type SyncResult = { inserted: number; updated: number; skipped_deleted: number };

/**
 * Rebuilds journal trades of one linked MT5 account from its stored deals: all positions, or only `positionIds`.
 * Only broker facts are written (see trade-sync.ts); net and R come from derivedFinancials (ADR 0003).
 */
export async function syncPositions(db: Db, terminal: { id: string; user_id: string; account_id: string }, positionIds: number[] | "all"): Promise<SyncResult> {
  const result: SyncResult = { inserted: 0, updated: 0, skipped_deleted: 0 };
  const { data: account } = await db.from("accounts").select("id, broker_timezone, initial_balance").eq("id", terminal.account_id).eq("user_id", terminal.user_id).maybeSingle();
  if (!account) return result;
  if (account.initial_balance === null) {
    // An account the Bridge created starts with the broker's deposits as its starting balance (never overwrites the owner's value).
    const { data: deposits } = await db.from("bridge_deals").select("type, profit").eq("terminal_account_id", terminal.id).eq("type", 2).limit(1000);
    const total = depositsTotal((deposits ?? []).map(deal => ({ type: Number(deal.type), profit: Number(deal.profit) })));
    if (total !== null) await db.from("accounts").update({ initial_balance: total }).eq("id", terminal.account_id).eq("user_id", terminal.user_id).is("initial_balance", null);
  }
  if (positionIds !== "all" && positionIds.length === 0) return result;

  const page = async <T>(table: "bridge_deals" | "bridge_orders", columns: string): Promise<T[]> => {
    const rows: T[] = [];
    for (let from = 0; ; from += 1000) {
      let query = db.from(table).select(columns).eq("terminal_account_id", terminal.id);
      if (positionIds !== "all") query = query.in("position_id", positionIds);
      const { data, error } = await query.order(table === "bridge_deals" ? "deal_ticket" : "order_ticket").range(from, from + 999);
      if (error) throw new Error(`Failed to read ${table}`);
      rows.push(...((data ?? []) as T[]));
      if (!data || data.length < 1000) return rows;
    }
  };
  const dealRows = await page<Record<string, unknown>>("bridge_deals", "deal_ticket, order_ticket, position_id, time_msc, type, entry, symbol, volume, price, profit, commission, swap, fee, reason");
  const orderRows = await page<Record<string, unknown>>("bridge_orders", "order_ticket, position_id, time_setup_msc, sl, tp");
  const deals: Mt5Deal[] = dealRows.map(row => ({
    ticket: num(row.deal_ticket), order: num(row.order_ticket), position_id: num(row.position_id), time_msc: num(row.time_msc),
    type: num(row.type), entry: num(row.entry), symbol: String(row.symbol), volume: num(row.volume), price: num(row.price),
    profit: num(row.profit), commission: num(row.commission), swap: num(row.swap), fee: num(row.fee), reason: num(row.reason),
  }));
  const orders: Mt5Order[] = orderRows.map(row => ({ ticket: num(row.order_ticket), position_id: num(row.position_id), time_setup_msc: num(row.time_setup_msc), sl: num(row.sl), tp: num(row.tp) }));
  const built = buildTrades(deals, orders, account.broker_timezone as string);
  if (!built.length) return result;

  const keys = built.map(trade => trade.key);
  const links: PositionLink[] = [];
  for (let index = 0; index < keys.length; index += 500) {
    const { data, error } = await db.from("bridge_positions").select("position_key, trade_id, synced_at").eq("terminal_account_id", terminal.id).in("position_key", keys.slice(index, index + 500));
    if (error) throw new Error("Failed to read positions");
    links.push(...(data ?? []).map(row => ({ key: row.position_key as string, trade_id: row.trade_id as string | null, synced_at: row.synced_at as string | null })));
  }
  const { data: journalRows, error: journalError } = await db.from("journal_trades")
    .select("id, ticket, external_id, symbol, direction, opened_at, closed_at, entry_price, exit_price, stop_loss, take_profit, volume, gross_pnl, commission, swap, fee, meta")
    .eq("account_id", terminal.account_id).eq("user_id", terminal.user_id).limit(20000);
  if (journalError) throw new Error("Failed to read journal trades");
  const journal = (journalRows ?? []) as (JournalTradeRef & Record<string, unknown>)[];
  const journalById = new Map(journal.map(row => [row.id, row]));
  const plan = planSync(built, links, journal);
  result.skipped_deleted = plan.skippedDeleted.length;
  const syncedAt = new Date().toISOString();
  const bridgeMeta = (trade: (typeof built)[number]) => ({ position_id: trade.position_id, close_reason: trade.close_reason, deals: trade.deal_count, synced_at: syncedAt });
  const positionRows: { terminal_account_id: string; position_key: string; trade_id: string; synced_at: string }[] = [];

  for (let index = 0; index < plan.inserts.length; index += 200) {
    const rows = plan.inserts.slice(index, index + 200).map(({ trade }) => {
      const row = {
        user_id: terminal.user_id, account_id: terminal.account_id, source: "mt5", ticket: trade.key, external_id: trade.key,
        symbol: trade.symbol, raw_symbol: trade.raw_symbol, direction: trade.direction,
        opened_at: trade.opened_at, closed_at: trade.closed_at, entry_price: trade.entry_price, exit_price: trade.exit_price,
        stop_loss: trade.stop_loss, take_profit: trade.take_profit, volume: trade.volume,
        gross_pnl: trade.gross_pnl, commission: trade.commission, swap: trade.swap, fee: trade.fee,
        meta: { bridge: bridgeMeta(trade) },
      };
      return { ...row, ...derivedFinancials(row) };
    });
    const { data, error } = await db.from("journal_trades").insert(rows).select("id, ticket");
    if (error) throw new Error("Failed to insert trades");
    for (const row of data ?? []) positionRows.push({ terminal_account_id: terminal.id, position_key: row.ticket as string, trade_id: row.id as string, synced_at: syncedAt });
    result.inserted += data?.length ?? 0;
  }

  for (const update of plan.updates) {
    const current: Record<string, unknown> = journalById.get(update.trade_id) ?? {};
    if (!differs(update.patch, current)) continue;
    const merged = { ...current, ...update.patch };
    const meta = current.meta && typeof current.meta === "object" && !Array.isArray(current.meta) ? current.meta as Record<string, unknown> : {};
    const { error } = await db.from("journal_trades")
      .update({ ...update.patch, ...derivedFinancials(merged), meta: { ...meta, bridge: bridgeMeta(update.trade) }, updated_at: syncedAt })
      .eq("id", update.trade_id).eq("user_id", terminal.user_id);
    if (error) throw new Error("Failed to update a trade");
    positionRows.push({ terminal_account_id: terminal.id, position_key: update.trade.key, trade_id: update.trade_id, synced_at: syncedAt });
    result.updated += 1;
  }

  for (let index = 0; index < positionRows.length; index += 500) {
    const { error } = await db.from("bridge_positions").upsert(positionRows.slice(index, index + 500), { onConflict: "terminal_account_id,position_key" });
    if (error) throw new Error("Failed to save position links");
  }
  await db.from("bridge_terminal_accounts").update({ last_sync_at: syncedAt }).eq("id", terminal.id);
  return result;
}
