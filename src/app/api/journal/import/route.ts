import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/session";
import { splitDuplicates, type ImportedTrade } from "@/lib/journal/csv-import";
import { derivedFinancials } from "@/lib/journal/trade-financials";

export const dynamic = "force-dynamic";
const MAX_ROWS = 5000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

const text = (value: unknown, max = 2000) => (typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null);
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** Re-validates a client-parsed row: the browser does the parsing, the server trusts nothing it sends. */
function clean(raw: unknown): ImportedTrade | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const symbol = text(row.symbol, 40)?.toUpperCase();
  const direction = row.direction === "Long" || row.direction === "Short" ? row.direction : null;
  const opened = typeof row.opened_at === "string" && Number.isFinite(Date.parse(row.opened_at)) ? new Date(row.opened_at).toISOString() : null;
  if (!symbol || !direction || !opened) return null;
  const closed = typeof row.closed_at === "string" && Number.isFinite(Date.parse(row.closed_at)) ? new Date(row.closed_at).toISOString() : null;
  return {
    symbol, direction, opened_at: opened, closed_at: closed,
    entry_price: num(row.entry_price), exit_price: num(row.exit_price), stop_loss: num(row.stop_loss), take_profit: num(row.take_profit), volume: num(row.volume),
    gross_pnl: num(row.gross_pnl), commission: num(row.commission), swap: num(row.swap), fee: num(row.fee),
    risk_percent: num(row.risk_percent), risk_amount: num(row.risk_amount),
    setup: text(row.setup, 200), emotion: text(row.emotion, 60), mistake: text(row.mistake, 200), entry_reason: text(row.entry_reason), notes: text(row.notes), screenshot_url: text(row.screenshot_url, 500),
    external_id: text(row.external_id, 100), market: text(row.market, 40),
    followed_plan: typeof row.followed_plan === "boolean" ? row.followed_plan : null,
  };
}

/**
 * POST { account_id, trades: ImportedTrade[], dryRun }
 * Trades already in the account (same ticket, or same symbol/direction/opening minute/entry) are skipped,
 * never changed. dryRun only reports what would happen. Net P&L and R are computed here, as for any trade.
 */
export async function POST(request: Request) {
  const context = await requireUser(request);
  if (context instanceof Response) return context;
  const { db, userId } = context;
  const body = await request.json().catch(() => null) as { account_id?: unknown; trades?: unknown; dryRun?: unknown } | null;
  if (!body || typeof body.account_id !== "string" || !UUID.test(body.account_id)) return json({ error: "account_id is required" }, 400);
  if (!Array.isArray(body.trades) || body.trades.length === 0) return json({ error: "No trades to import" }, 400);
  if (body.trades.length > MAX_ROWS) return json({ error: "Too many rows in one import" }, 400);

  const { data: account } = await db.from("accounts").select("id").eq("id", body.account_id).eq("user_id", userId).maybeSingle();
  if (!account) return json({ error: "Unknown account_id" }, 400);

  const cleaned = body.trades.map(clean);
  const invalid = cleaned.filter(trade => trade === null).length;
  const candidates = cleaned.filter((trade): trade is ImportedTrade => trade !== null);

  const { data: existing, error: readError } = await db.from("journal_trades").select("symbol, direction, opened_at, entry_price, external_id, ticket").eq("account_id", body.account_id).eq("user_id", userId).limit(20000);
  if (readError) return json({ error: "Failed to read existing trades" }, 500);
  const known = (existing ?? []).flatMap(row => [row, ...(row.ticket && row.ticket !== row.external_id ? [{ ...row, external_id: row.ticket }] : [])]);
  const { fresh, duplicates, shifted } = splitDuplicates(candidates, known);
  const offsets = [...new Set(shifted.map(item => item.hours))].slice(0, 5);

  if (body.dryRun === true) return json({ toImport: fresh.length, duplicates: duplicates.length, shifted: shifted.length, offsets, invalid });

  const importedAt = new Date().toISOString();
  const rows = fresh.map(({ followed_plan, ...trade }) => {
    const payload = {
      ...trade, gross_pnl: trade.gross_pnl ?? 0, commission: Math.abs(trade.commission ?? 0), swap: trade.swap ?? 0, fee: Math.abs(trade.fee ?? 0),
      source: "import", ticket: trade.external_id, user_id: userId, account_id: body.account_id as string,
      meta: { imported_at: importedAt, ...(followed_plan === null ? {} : { review: { reviewed_at: importedAt, followed_plan } }) },
    };
    return { ...payload, ...derivedFinancials(payload) };
  });
  let inserted = 0;
  for (let index = 0; index < rows.length; index += 200) {
    const { error, count } = await db.from("journal_trades").insert(rows.slice(index, index + 200), { count: "exact" });
    if (error) return json({ error: "Import stopped: a batch could not be saved", inserted, duplicates: duplicates.length + shifted.length, invalid }, error.code === "23505" ? 409 : 500);
    inserted += count ?? 0;
  }
  return json({ inserted, duplicates: duplicates.length + shifted.length, invalid }, 201);
}
