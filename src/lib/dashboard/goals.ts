/**
 * Monthly goals and the review streak on Home. Pure; months and days are counted in the user's zone (ADR 0001),
 * R and net as stored (ADR 0003).
 */
import { dayKey, dayKeyOrNull, shiftDay } from "../time/timezone";
import { needsReview, type ReviewTrade } from "../journal/trade-review";

export type GoalTrade = Pick<ReviewTrade, "setup" | "emotion" | "review"> & { opened_at: string; closed_at?: string | null; net_pnl?: number | null; result_r?: number | null };
export type GoalTargets = { targetR: number | null; maxRedDays: number | null; reviewShare: number | null };
export type MonthProgress = {
  month: string;
  r: number;
  rCount: number;
  redDays: number;
  tradingDays: number;
  reviewShare: number | null;
  closed: number;
};

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** Closed trades of the month that contains `now`, in the user's zone. */
export function monthProgress(trades: readonly GoalTrade[], timezone: string, now: Date | number = Date.now()): MonthProgress {
  const month = dayKey(now, timezone).slice(0, 7);
  const days = new Map<string, number>();
  let r = 0, rCount = 0, closed = 0, reviewed = 0;
  for (const trade of trades) {
    if (!trade.closed_at) continue;
    const day = dayKeyOrNull(trade.closed_at, timezone);
    if (!day || day.slice(0, 7) !== month) continue;
    closed += 1;
    if (finite(trade.result_r)) { r += trade.result_r; rCount += 1; }
    if (!needsReview(trade)) reviewed += 1;
    days.set(day, (days.get(day) ?? 0) + (finite(trade.net_pnl) ? trade.net_pnl : 0));
  }
  return {
    month, r: Math.round(r * 100) / 100, rCount, closed,
    redDays: [...days.values()].filter(net => net < 0).length,
    tradingDays: days.size,
    reviewShare: closed ? Math.round(reviewed / closed * 100) : null,
  };
}

/** Each target as done / on track / missed. A red-day cap is missed once exceeded; the others are judged against the target. */
export function goalStatus(progress: MonthProgress, targets: GoalTargets) {
  return {
    r: targets.targetR === null ? null : { value: progress.r, target: targets.targetR, share: targets.targetR > 0 ? Math.max(0, Math.min(1, progress.r / targets.targetR)) : progress.r >= targets.targetR ? 1 : 0, done: progress.r >= targets.targetR },
    redDays: targets.maxRedDays === null ? null : { value: progress.redDays, target: targets.maxRedDays, share: targets.maxRedDays > 0 ? Math.min(1, progress.redDays / targets.maxRedDays) : progress.redDays > 0 ? 1 : 0, done: progress.redDays <= targets.maxRedDays },
    review: targets.reviewShare === null ? null : { value: progress.reviewShare ?? 0, target: targets.reviewShare, share: targets.reviewShare > 0 ? Math.min(1, (progress.reviewShare ?? 0) / targets.reviewShare) : 1, done: (progress.reviewShare ?? 0) >= targets.reviewShare },
  };
}

/**
 * Days in a row, counting back from today, on which every closed trade is reviewed. Days without trades do not
 * break the streak; a day with an unreviewed trade does. Today counts only once it is fully reviewed.
 */
export function reviewStreak(trades: readonly GoalTrade[], timezone: string, now: Date | number = Date.now(), lookbackDays = 365): number {
  const byDay = new Map<string, { total: number; open: number }>();
  for (const trade of trades) {
    if (!trade.closed_at) continue;
    const day = dayKeyOrNull(trade.closed_at, timezone);
    if (!day) continue;
    const entry = byDay.get(day) ?? { total: 0, open: 0 };
    entry.total += 1;
    if (needsReview(trade)) entry.open += 1;
    byDay.set(day, entry);
  }
  let streak = 0;
  let day = dayKey(now, timezone);
  for (let index = 0; index < lookbackDays; index += 1, day = shiftDay(day, -1)) {
    const entry = byDay.get(day);
    if (!entry) continue;
    if (entry.open > 0) { if (index === 0) continue; break; }
    streak += 1;
  }
  return streak;
}
