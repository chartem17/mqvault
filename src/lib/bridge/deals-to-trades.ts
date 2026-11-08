/**
 * MT5 deals → journal trades (features/mt5-bridge.md §3.6). The Bridge sends raw deals and orders; all trade logic
 * lives here, on the server, so it is tested like the rest of src/lib and never duplicated on the PC.
 *
 * One position (position_id) is one trade: partial entries and exits are volume-weighted, every deal's costs are
 * summed. A reversal on a netting account (entry = INOUT) closes the trade and opens a new one in the opposite
 * direction under the same position id; the second trade's key is "<position_id>:2", and so on.
 * Net P&L and R are NOT computed here: the caller passes rows through derivedFinancials (ADR 0003).
 */
import { serverWallToUtcMs } from "./broker-clock";

/** MetaTrader5 constants used below. */
export const DEAL_TYPE = { BUY: 0, SELL: 1 } as const;
export const DEAL_ENTRY = { IN: 0, OUT: 1, INOUT: 2, OUT_BY: 3 } as const;
const CLOSE_REASON: Record<number, CloseReason> = { 4: "sl", 5: "tp", 6: "stop_out" };

export type CloseReason = "sl" | "tp" | "stop_out" | "manual";

export type Mt5Deal = {
  ticket: number; order: number; position_id: number; time_msc: number; type: number; entry: number;
  symbol: string; volume: number; price: number; profit: number; commission: number; swap: number; fee: number; reason: number;
};
export type Mt5Order = { ticket: number; position_id: number; time_setup_msc: number; sl: number; tp: number };

export type BuiltTrade = {
  key: string; position_id: number; segment: number;
  symbol: string; raw_symbol: string; direction: "Long" | "Short";
  opened_at: string; closed_at: string | null;
  entry_price: number | null; exit_price: number | null; volume: number | null;
  stop_loss: number | null; take_profit: number | null;
  gross_pnl: number; commission: number; swap: number; fee: number;
  close_reason: CloseReason | null; deal_count: number;
};

const EPS = 1e-9;
const round = (value: number, digits = 8) => { const k = 10 ** digits; return Math.round(value * k) / k; };

/** "EURUSD.raw" → "EURUSD", "US30.cash" → "US30", "XAUUSD#" → "XAUUSD". The broker's spelling stays in raw_symbol. */
export function cleanSymbol(raw: string): string {
  const upper = raw.trim().toUpperCase();
  const base = upper.split(/[.#_\s]/)[0];
  return base.length >= 3 ? base : upper;
}

type Leg = { volume: number; price: number };
type Segment = {
  direction: "Long" | "Short"; openMs: number; closeMs: number | null; openOrder: number | null;
  ins: Leg[]; outs: Leg[]; remaining: number;
  gross: number; commission: number; swap: number; fee: number; reason: number | null; deals: number;
};

const vwap = (legs: Leg[]) => {
  const volume = legs.reduce((sum, leg) => sum + leg.volume, 0);
  return volume > EPS ? round(legs.reduce((sum, leg) => sum + leg.volume * leg.price, 0) / volume) : null;
};

function newSegment(direction: "Long" | "Short", openMs: number, openOrder: number | null): Segment {
  return { direction, openMs, closeMs: null, openOrder, ins: [], outs: [], remaining: 0, gross: 0, commission: 0, swap: 0, fee: 0, reason: null, deals: 0 };
}

function addCosts(segment: Segment, deal: Mt5Deal) {
  segment.commission += Math.abs(deal.commission || 0);
  segment.fee += Math.abs(deal.fee || 0);
  segment.swap += deal.swap || 0;
  segment.deals += 1;
}

/** Splits one position's deals (any order) into trade segments. */
function segmentsOf(deals: Mt5Deal[]): Segment[] {
  const sorted = [...deals].sort((a, b) => a.time_msc - b.time_msc || a.ticket - b.ticket);
  const done: Segment[] = [];
  let current: Segment | null = null;
  for (const deal of sorted) {
    const side = deal.type === DEAL_TYPE.BUY ? "Long" : "Short";
    if (deal.entry === DEAL_ENTRY.IN) {
      current ??= newSegment(side, deal.time_msc, deal.order);
      current.ins.push({ volume: deal.volume, price: deal.price });
      current.remaining += deal.volume;
      current.gross += deal.profit || 0;
      addCosts(current, deal);
      continue;
    }
    // OUT, OUT_BY or INOUT. An exit with no known entry (history cut off) still becomes a trade, without entry price.
    current ??= newSegment(side === "Long" ? "Short" : "Long", deal.time_msc, null);
    const closing = deal.entry === DEAL_ENTRY.INOUT ? Math.min(deal.volume, current.remaining) : deal.volume;
    current.outs.push({ volume: closing, price: deal.price });
    current.remaining -= closing;
    current.gross += deal.profit || 0;
    current.reason = deal.reason;
    addCosts(current, deal);
    if (current.remaining <= EPS) {
      current.closeMs = deal.time_msc;
      done.push(current);
      current = null;
      const left = deal.volume - closing;
      if (deal.entry === DEAL_ENTRY.INOUT && left > EPS) {
        current = newSegment(side, deal.time_msc, deal.order);
        current.ins.push({ volume: left, price: deal.price });
        current.remaining = left;
      }
    }
  }
  if (current) done.push(current);
  return done;
}

/** Initial stop/take of a trade: from the order that opened it, else the earliest order of the position that had one. */
function initialLevels(orders: Mt5Order[], openOrder: number | null): { sl: number | null; tp: number | null } {
  const sorted = [...orders].sort((a, b) => a.time_setup_msc - b.time_setup_msc || a.ticket - b.ticket);
  const opening = sorted.find(order => order.ticket === openOrder);
  const pick = (field: "sl" | "tp") => {
    if (opening && opening[field] > 0) return opening[field];
    const any = sorted.find(order => order[field] > 0);
    return any ? any[field] : null;
  };
  return { sl: pick("sl"), tp: pick("tp") };
}

/**
 * Builds journal trades from all stored deals and orders of one MT5 account.
 * Only buy/sell deals count; balance, credit and other non-trading deals are ignored here.
 * `zone` is the account's broker_timezone used to turn server wall time into UTC.
 */
export function buildTrades(deals: readonly Mt5Deal[], orders: readonly Mt5Order[], zone: string): BuiltTrade[] {
  const byPosition = new Map<number, Mt5Deal[]>();
  for (const deal of deals) {
    if (deal.type !== DEAL_TYPE.BUY && deal.type !== DEAL_TYPE.SELL) continue;
    if (!deal.position_id) continue;
    const list = byPosition.get(deal.position_id) ?? [];
    list.push(deal);
    byPosition.set(deal.position_id, list);
  }
  const ordersByPosition = new Map<number, Mt5Order[]>();
  for (const order of orders) {
    const list = ordersByPosition.get(order.position_id) ?? [];
    list.push(order);
    ordersByPosition.set(order.position_id, list);
  }
  const toIso = (serverMs: number) => new Date(serverWallToUtcMs(serverMs, zone)).toISOString();

  const trades: BuiltTrade[] = [];
  for (const [positionId, positionDeals] of byPosition) {
    const symbol = positionDeals[0].symbol;
    segmentsOf(positionDeals).forEach((segment, index) => {
      const levels = index === 0 || segment.openOrder !== null ? initialLevels(ordersByPosition.get(positionId) ?? [], segment.openOrder) : { sl: null, tp: null };
      const inVolume = segment.ins.reduce((sum, leg) => sum + leg.volume, 0);
      const closed = segment.closeMs !== null;
      trades.push({
        key: index === 0 ? String(positionId) : `${positionId}:${index + 1}`,
        position_id: positionId, segment: index + 1,
        symbol: cleanSymbol(symbol), raw_symbol: symbol, direction: segment.direction,
        opened_at: toIso(segment.openMs), closed_at: closed ? toIso(segment.closeMs as number) : null,
        entry_price: vwap(segment.ins), exit_price: vwap(segment.outs),
        volume: inVolume > EPS ? round(inVolume) : segment.outs.length ? round(segment.outs.reduce((sum, leg) => sum + leg.volume, 0)) : null,
        stop_loss: levels.sl, take_profit: levels.tp,
        gross_pnl: round(segment.gross), commission: round(segment.commission), swap: round(segment.swap), fee: round(segment.fee),
        close_reason: closed ? CLOSE_REASON[segment.reason ?? -1] ?? "manual" : null,
        deal_count: segment.deals,
      });
    });
  }
  return trades.sort((a, b) => a.opened_at.localeCompare(b.opened_at) || a.key.localeCompare(b.key));
}
