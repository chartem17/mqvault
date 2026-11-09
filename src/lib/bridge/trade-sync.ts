/**
 * Which built trades to insert, update or leave alone (features/mt5-bridge.md §3.6, items 3–5).
 *
 * - Sync owns only broker facts: prices, volume, times, gross/costs, closing. Setup, emotions, notes, screenshots and
 *   the review are never written. Stop/take are filled only while the journal has none (the owner may correct them for R).
 * - A trade the owner deleted is never brought back: its position row stays with trade_id = null (ADR 0005).
 * - A trade already in the journal (CSV import or typed by hand) is attached, not duplicated: same ticket, or same
 *   symbol, direction, opening minute (±1) and entry price within 0.05 %.
 */
import type { BuiltTrade } from "./deals-to-trades";

export type PositionLink = { key: string; trade_id: string | null; synced_at: string | null };
export type JournalTradeRef = {
  id: string; ticket: string | null; external_id: string | null; symbol: string; direction: string;
  opened_at: string; entry_price: number | string | null; stop_loss: number | string | null; take_profit: number | string | null;
};

export type BrokerFields = Pick<BuiltTrade, "opened_at" | "closed_at" | "entry_price" | "exit_price" | "volume" | "gross_pnl" | "commission" | "swap" | "fee">;
export type SyncPlan = {
  inserts: { trade: BuiltTrade }[];
  updates: { trade: BuiltTrade; trade_id: string; patch: Record<string, unknown> }[];
  skippedDeleted: string[];
};

export function brokerFields(trade: BuiltTrade): BrokerFields {
  return {
    opened_at: trade.opened_at, closed_at: trade.closed_at, entry_price: trade.entry_price, exit_price: trade.exit_price,
    volume: trade.volume, gross_pnl: trade.gross_pnl, commission: trade.commission, swap: trade.swap, fee: trade.fee,
  };
}

const symbolKey = (symbol: string) => symbol.trim().toUpperCase().split(/[.#_\s]/)[0].replace(/[^A-Z0-9]/g, "");
const num = (value: number | string | null | undefined) => (value === null || value === undefined || value === "" ? null : Number(value));

function sameEntry(journal: JournalTradeRef, trade: BuiltTrade): boolean {
  if (symbolKey(journal.symbol) !== symbolKey(trade.symbol) || journal.direction !== trade.direction) return false;
  const minutes = Math.abs(Math.floor(Date.parse(journal.opened_at) / 60_000) - Math.floor(Date.parse(trade.opened_at) / 60_000));
  if (!(minutes <= 1)) return false;
  const price = num(journal.entry_price);
  if (price === null || trade.entry_price === null) return true;
  return Math.abs(price - trade.entry_price) <= Math.abs(trade.entry_price) * 0.0005;
}

export function planSync(built: readonly BuiltTrade[], links: readonly PositionLink[], journal: readonly JournalTradeRef[]): SyncPlan {
  const linkByKey = new Map(links.map(link => [link.key, link]));
  const journalById = new Map(journal.map(row => [row.id, row]));
  const linked = new Set(links.map(link => link.trade_id).filter((id): id is string => !!id));
  const free = journal.filter(row => !linked.has(row.id));
  const taken = new Set<string>();
  const plan: SyncPlan = { inserts: [], updates: [], skippedDeleted: [] };

  for (const trade of built) {
    const link = linkByKey.get(trade.key);
    if (link && link.synced_at && !link.trade_id) { plan.skippedDeleted.push(trade.key); continue; }
    let target = link?.trade_id ? journalById.get(link.trade_id) ?? null : null;
    if (!target) {
      target = free.find(row => !taken.has(row.id) && (row.ticket === trade.key || row.external_id === trade.key))
        ?? free.find(row => !taken.has(row.id) && !row.ticket && sameEntry(row, trade))
        ?? null;
    }
    if (!target) { plan.inserts.push({ trade }); continue; }
    taken.add(target.id);
    const patch: Record<string, unknown> = { ...brokerFields(trade), ticket: trade.key };
    if (num(target.stop_loss) === null && trade.stop_loss !== null) patch.stop_loss = trade.stop_loss;
    if (num(target.take_profit) === null && trade.take_profit !== null) patch.take_profit = trade.take_profit;
    plan.updates.push({ trade, trade_id: target.id, patch });
  }
  return plan;
}
