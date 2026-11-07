import { getSessionKey, SESSION_DEFINITIONS } from "../time/sessions";
import { zonedParts } from "../time/timezone";

/**
 * "Where I earn / lose": results grouped by symbol, session, weekday, hour or setup, plus a
 * weekday × hour grid. R is the main measure (comparable across accounts and sizes); net P&L
 * is shown next to it. Weekday and hour are in the user's zone; sessions follow market clocks.
 */
export type BreakdownDimension = "symbol" | "session" | "weekday" | "hour" | "setup";
export type BreakdownTrade = { opened_at: string; symbol: string; setup?: string | null; net_pnl?: number | null; result_r?: number | null };
export type BreakdownRow = {
  key: string;
  trades: number;
  /** Trades with a known R; avgR and totalR use only these. */
  withR: number;
  totalR: number;
  avgR: number | null;
  /** Share of winning trades among those with a known net P&L, 0–100. */
  winRate: number | null;
  net: number;
  /** Fewer than MIN_SAMPLE trades: show, but do not draw conclusions. */
  small: boolean;
};
export type HeatCell = { weekday: number; hour: number; trades: number; withR: number; totalR: number; avgR: number | null };

export const MIN_SAMPLE = 5;
export const BREAKDOWN_DIMENSIONS: readonly BreakdownDimension[] = ["symbol", "session", "weekday", "hour", "setup"];
const round = (value: number) => Math.round(value * 100) / 100;
const SESSION_ORDER: string[] = SESSION_DEFINITIONS.map(session => session.key);

/** EUR/USD, eurusd and EURUSD are one instrument. */
export function symbolKey(symbol: string): string { return symbol.replace(/[^a-z0-9]/gi, "").toUpperCase(); }

/** ISO weekday 1 (Monday) … 7 (Sunday) and hour of the trade's opening in `timezone`. */
export function openedAt(trade: { opened_at: string }, timezone: string): { weekday: number; hour: number } | null {
  const ms = Date.parse(trade.opened_at);
  if (!Number.isFinite(ms)) return null;
  const { date, hour } = zonedParts(ms, timezone);
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return { weekday: day === 0 ? 7 : day, hour };
}

function keyOf(trade: BreakdownTrade, dimension: BreakdownDimension, timezone: string): string | null {
  switch (dimension) {
    case "symbol": return symbolKey(trade.symbol) || null;
    case "setup": return trade.setup?.trim() || "";
    case "session": try { return getSessionKey(trade.opened_at); } catch { return null; }
    case "weekday": return openedAt(trade, timezone)?.weekday.toString() ?? null;
    case "hour": { const at = openedAt(trade, timezone); return at ? String(at.hour).padStart(2, "0") : null; }
  }
}

type Acc = { trades: number; withR: number; totalR: number; known: number; wins: number; net: number };
const empty = (): Acc => ({ trades: 0, withR: 0, totalR: 0, known: 0, wins: 0, net: 0 });
function add(acc: Acc, trade: BreakdownTrade) {
  acc.trades++;
  if (typeof trade.result_r === "number" && Number.isFinite(trade.result_r)) { acc.withR++; acc.totalR += trade.result_r; }
  if (typeof trade.net_pnl === "number" && Number.isFinite(trade.net_pnl)) { acc.known++; acc.net += trade.net_pnl; if (trade.net_pnl > 0) acc.wins++; }
}

/**
 * Rows for one dimension. Weekday, hour and session keep their natural order; symbol and setup
 * are sorted from the best total R to the worst (rows without any R go last).
 */
export function breakdown(trades: readonly BreakdownTrade[], dimension: BreakdownDimension, timezone: string): BreakdownRow[] {
  const groups = new Map<string, Acc>();
  for (const trade of trades) {
    const key = keyOf(trade, dimension, timezone);
    if (key === null) continue;
    const acc = groups.get(key) ?? empty();
    add(acc, trade); groups.set(key, acc);
  }
  const rows = [...groups.entries()].map(([key, acc]): BreakdownRow => ({
    key, trades: acc.trades, withR: acc.withR, totalR: round(acc.totalR),
    avgR: acc.withR ? round(acc.totalR / acc.withR) : null,
    winRate: acc.known ? Math.round((acc.wins / acc.known) * 1000) / 10 : null,
    net: round(acc.net), small: acc.trades < MIN_SAMPLE,
  }));
  if (dimension === "weekday" || dimension === "hour") return rows.sort((a, b) => Number(a.key) - Number(b.key));
  if (dimension === "session") return rows.sort((a, b) => SESSION_ORDER.indexOf(a.key) - SESSION_ORDER.indexOf(b.key));
  return rows.sort((a, b) => (b.withR ? b.totalR : -Infinity) - (a.withR ? a.totalR : -Infinity) || b.trades - a.trades || a.key.localeCompare(b.key));
}

/** Weekday × hour cells that have trades (sparse). */
export function weekdayHourGrid(trades: readonly BreakdownTrade[], timezone: string): HeatCell[] {
  const cells = new Map<string, Acc & { weekday: number; hour: number }>();
  for (const trade of trades) {
    const at = openedAt(trade, timezone);
    if (!at) continue;
    const id = `${at.weekday}:${at.hour}`;
    const cell = cells.get(id) ?? { ...empty(), ...at };
    add(cell, trade); cells.set(id, cell);
  }
  return [...cells.values()]
    .map(cell => ({ weekday: cell.weekday, hour: cell.hour, trades: cell.trades, withR: cell.withR, totalR: round(cell.totalR), avgR: cell.withR ? round(cell.totalR / cell.withR) : null }))
    .sort((a, b) => a.weekday - b.weekday || a.hour - b.hour);
}
