/**
 * Lifetime summary for the profile page: what the rest of the app does not show in one place.
 * Pure; days are counted in the user's time zone (ADR 0001); net and R are taken as stored (ADR 0003).
 */
import { dayKeyOrNull } from "../time/timezone";

export type SummaryTrade = {
  symbol?: string | null;
  opened_at?: string | null;
  closed_at?: string | null;
  net_pnl?: number | null;
  result_r?: number | null;
  setup?: string | null;
  emotion?: string | null;
  review?: { reviewed_at: string } | null;
};

export type TraderSummary = {
  closed: number;
  winRate: number | null;
  averageR: number | null;
  tradingDays: number;
  firstDay: string | null;
  topSymbol: { symbol: string; count: number } | null;
  reviewedShare: number | null;
  bestDay: { day: string; net: number } | null;
  worstDay: { day: string; net: number } | null;
};

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function traderSummary(trades: readonly SummaryTrade[], timezone: string): TraderSummary {
  const closed = trades.filter(trade => trade.closed_at);
  const withNet = closed.filter(trade => finite(trade.net_pnl));
  const wins = withNet.filter(trade => (trade.net_pnl as number) > 0).length;
  const rs = closed.map(trade => trade.result_r).filter(finite);
  const days = new Map<string, number>();
  const symbols = new Map<string, number>();
  for (const trade of trades) {
    const day = dayKeyOrNull(trade.opened_at ?? null, timezone);
    if (day) days.set(day, (days.get(day) ?? 0) + (trade.closed_at && finite(trade.net_pnl) ? trade.net_pnl : 0));
    const symbol = (trade.symbol ?? "").trim().toUpperCase().replace("/", "");
    if (symbol) symbols.set(symbol, (symbols.get(symbol) ?? 0) + 1);
  }
  const sortedDays = [...days.keys()].sort();
  const ranked = [...days.entries()].filter(([, net]) => net !== 0).sort((a, b) => b[1] - a[1]);
  const top = [...symbols.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const reviewed = closed.filter(trade => trade.review || trade.setup || trade.emotion).length;
  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    closed: closed.length,
    winRate: withNet.length ? round(wins / withNet.length * 100) : null,
    averageR: rs.length ? round(rs.reduce((sum, r) => sum + r, 0) / rs.length) : null,
    tradingDays: days.size,
    firstDay: sortedDays[0] ?? null,
    topSymbol: top ? { symbol: top[0], count: top[1] } : null,
    reviewedShare: closed.length ? round(reviewed / closed.length * 100) : null,
    bestDay: ranked[0] && ranked[0][1] > 0 ? { day: ranked[0][0], net: round(ranked[0][1]) } : null,
    worstDay: ranked.length && ranked[ranked.length - 1][1] < 0 ? { day: ranked[ranked.length - 1][0], net: round(ranked[ranked.length - 1][1]) } : null,
  };
}
