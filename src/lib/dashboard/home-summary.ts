import { dayKey, dayKeyOrNull } from "../time/timezone";
import { msg } from "../i18n/core";
import { needsReview, type TradeReview } from "../journal/trade-review";

export type HomeTrade = { id: string; account_id: string; symbol: string; direction: string; opened_at: string; closed_at?: string | null; net_pnl?: number | null; result_r?: number | null; setup?: string | null; emotion?: string | null; review?: TradeReview | null };
export type StrategyLimits = { maxTrades: number | null; maxLosses: number | null };

export type TodaySummary = {
  day: string;
  opened: number;
  closedCount: number;
  losses: number;
  wins: number;
  /** Realised P&L of trades closed today; null when any of them has no net P&L. */
  netPnl: number | null;
  limits: StrategyLimits;
};

/** Trades are attributed to a day in the user's zone: counts by opening time, P&L by closing time (open trades have no realised P&L yet). */
export function summarizeToday(trades: readonly HomeTrade[], timezone: string, now = new Date(), limits: StrategyLimits = { maxTrades: null, maxLosses: null }): TodaySummary {
  const day = dayKey(now, timezone);
  const opened = trades.filter(trade => dayKeyOrNull(trade.opened_at, timezone) === day);
  const closed = trades.filter(trade => dayKeyOrNull(trade.closed_at, timezone) === day);
  const known = closed.filter(trade => typeof trade.net_pnl === "number" && Number.isFinite(trade.net_pnl));
  return {
    day, opened: opened.length, closedCount: closed.length,
    wins: known.filter(trade => (trade.net_pnl as number) > 0).length,
    losses: known.filter(trade => (trade.net_pnl as number) < 0).length,
    netPnl: known.length === closed.length ? known.reduce((sum, trade) => sum + (trade.net_pnl as number), 0) : null,
    limits,
  };
}

/** Rough room left before the configured daily loss limit, from journal data only (not the firm's own accounting). */
export function dailyLossRoom(initialBalance: number | null, dailyLossPercent: number | null, todayNet: number | null): { limit: number; room: number } | null {
  if (initialBalance === null || dailyLossPercent === null || todayNet === null || initialBalance <= 0 || dailyLossPercent <= 0) return null;
  const limit = initialBalance * dailyLossPercent / 100;
  return { limit, room: Math.max(0, limit + Math.min(0, todayNet)) };
}

/** Net P&L per day for the last `days` days ending today (oldest first), by closing day in the user's zone. */
export function lastDays(trades: readonly HomeTrade[], timezone: string, days: number, now = new Date()): { day: string; net: number; count: number }[] {
  const byDay = new Map<string, { net: number; count: number }>();
  for (const trade of trades) {
    const day = dayKeyOrNull(trade.closed_at, timezone);
    if (!day || typeof trade.net_pnl !== "number" || !Number.isFinite(trade.net_pnl)) continue;
    const entry = byDay.get(day) ?? { net: 0, count: 0 };
    entry.net += trade.net_pnl; entry.count++; byDay.set(day, entry);
  }
  const out: { day: string; net: number; count: number }[] = [];
  for (let offset = days - 1; offset >= 0; offset--) {
    const day = dayKey(now.getTime() - offset * 86_400_000, timezone);
    if (out.some(item => item.day === day)) continue;
    out.push({ day, ...(byDay.get(day) ?? { net: 0, count: 0 }) });
  }
  return out;
}

/** Trades waiting in the day review: not reviewed yet and missing a setup or an emotion. */
export function unmarkedTrades<T extends HomeTrade>(trades: readonly T[]): T[] {
  return trades.filter(needsReview);
}

/** English greeting for the hour; translate it with `t()` when rendering. */
export function greetingFor(hour: number): string {
  if (hour < 5) return msg("Good night");
  if (hour < 12) return msg("Good morning");
  if (hour < 18) return msg("Good afternoon");
  return msg("Good evening");
}
