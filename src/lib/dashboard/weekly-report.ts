import { dayKey, shiftDay } from "../time/timezone";
import { breakdown, type BreakdownRow } from "../journal/performance-breakdown";
import { needsReview, type TradeReview } from "../journal/trade-review";

/**
 * Weekly report: Monday–Sunday in the user's zone. A trade belongs to the week it was opened in.
 * R is the comparable measure; net P&L is shown next to it. Nothing is estimated: a number that
 * cannot be computed from the journal is null.
 */
export type ReportTrade = {
  id: string; opened_at: string; closed_at?: string | null; symbol: string; direction: string;
  net_pnl?: number | null; result_r?: number | null; setup?: string | null; emotion?: string | null; mistake?: string | null;
  review?: TradeReview | null;
};
export type WeekTotals = { trades: number; net: number; withR: number; totalR: number; avgR: number | null; winRate: number | null };
export type DayLine = { day: string; trades: number; net: number; totalR: number; withR: number };
export type MistakeLine = { mistake: string; trades: number; totalR: number };
export type WeeklyReport<T extends ReportTrade> = {
  start: string; end: string;
  totals: WeekTotals;
  previous: WeekTotals;
  days: DayLine[];
  best: T | null; worst: T | null;
  symbols: BreakdownRow[]; sessions: BreakdownRow[];
  discipline: { reviewed: number; waiting: number; followed: number; broken: number; mistakes: MistakeLine[]; emotions: { emotion: string; trades: number; totalR: number }[] };
};

const round = (value: number) => Math.round(value * 100) / 100;
const hasR = (trade: ReportTrade) => typeof trade.result_r === "number" && Number.isFinite(trade.result_r);
const hasNet = (trade: ReportTrade) => typeof trade.net_pnl === "number" && Number.isFinite(trade.net_pnl);

/** Monday of the week that contains `day` (YYYY-MM-DD). */
export function weekStart(day: string): string {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return shiftDay(day, -((weekday + 6) % 7));
}

function inWeek<T extends ReportTrade>(trades: readonly T[], start: string, timezone: string): T[] {
  const end = shiftDay(start, 6);
  return trades.filter(trade => { const ms = Date.parse(trade.opened_at); if (!Number.isFinite(ms)) return false; const day = dayKey(ms, timezone); return day >= start && day <= end; });
}

export function totals(trades: readonly ReportTrade[]): WeekTotals {
  const withR = trades.filter(hasR), known = trades.filter(hasNet);
  const totalR = withR.reduce((sum, trade) => sum + (trade.result_r as number), 0);
  return {
    trades: trades.length,
    net: round(known.reduce((sum, trade) => sum + (trade.net_pnl as number), 0)),
    withR: withR.length, totalR: round(totalR),
    avgR: withR.length ? round(totalR / withR.length) : null,
    winRate: known.length ? Math.round((known.filter(trade => (trade.net_pnl as number) > 0).length / known.length) * 1000) / 10 : null,
  };
}

/** The latest week (its Monday) that has trades, or the current week when there are none. */
export function latestWeekWithTrades(trades: readonly ReportTrade[], timezone: string, now = new Date()): string {
  let latest: string | null = null;
  for (const trade of trades) { const ms = Date.parse(trade.opened_at); if (!Number.isFinite(ms)) continue; const day = dayKey(ms, timezone); if (!latest || day > latest) latest = day; }
  return weekStart(latest ?? dayKey(now, timezone));
}

export function weeklyReport<T extends ReportTrade>(all: readonly T[], start: string, timezone: string): WeeklyReport<T> {
  const monday = weekStart(start);
  const trades = inWeek(all, monday, timezone);
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = shiftDay(monday, index);
    const list = trades.filter(trade => dayKey(Date.parse(trade.opened_at), timezone) === day);
    const t = totals(list);
    return { day, trades: t.trades, net: t.net, totalR: t.totalR, withR: t.withR };
  });
  const ranked = trades.filter(hasR).sort((a, b) => (b.result_r as number) - (a.result_r as number) || a.opened_at.localeCompare(b.opened_at));
  const best = ranked.length && (ranked[0].result_r as number) > 0 ? ranked[0] : null;
  const worst = ranked.length && (ranked[ranked.length - 1].result_r as number) < 0 ? ranked[ranked.length - 1] : null;

  const mistakes = new Map<string, MistakeLine>();
  const emotions = new Map<string, { emotion: string; trades: number; totalR: number }>();
  for (const trade of trades) {
    const mistake = trade.mistake?.trim();
    if (mistake) { const line = mistakes.get(mistake.toLowerCase()) ?? { mistake, trades: 0, totalR: 0 }; line.trades++; if (hasR(trade)) line.totalR = round(line.totalR + (trade.result_r as number)); mistakes.set(mistake.toLowerCase(), line); }
    const emotion = trade.emotion?.trim();
    if (emotion) { const line = emotions.get(emotion) ?? { emotion, trades: 0, totalR: 0 }; line.trades++; if (hasR(trade)) line.totalR = round(line.totalR + (trade.result_r as number)); emotions.set(emotion, line); }
  }

  return {
    start: monday, end: shiftDay(monday, 6),
    totals: totals(trades),
    previous: totals(inWeek(all, shiftDay(monday, -7), timezone)),
    days, best, worst,
    symbols: breakdown(trades, "symbol", timezone),
    sessions: breakdown(trades, "session", timezone).sort((a, b) => b.totalR - a.totalR),
    discipline: {
      reviewed: trades.filter(trade => !needsReview(trade)).length,
      waiting: trades.filter(needsReview).length,
      followed: trades.filter(trade => trade.review?.followed_plan === true).length,
      broken: trades.filter(trade => trade.review?.followed_plan === false).length,
      mistakes: [...mistakes.values()].sort((a, b) => a.totalR - b.totalR || b.trades - a.trades),
      emotions: [...emotions.values()].sort((a, b) => b.trades - a.trades),
    },
  };
}
