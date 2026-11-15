import { DEFAULT_TIMEZONE, dayKeyOrNull } from "../time/timezone";
import { byClosing, computeStats, maxDrawdown, rDistribution, type StatsTrade } from "./trade-stats";

export type { RBucket } from "./trade-stats";

export type DrawdownPoint = {
  date: string;
  equity: number;
  peak: number;
  drawdownPct: number;
};

/**
 * Only closed trades count; R figures skip trades without a known R (ADR 0020).
 * @param tz zone that decides which calendar day a trade belongs to (the user's zone).
 * @param startBalance account starting balance; drawdown % is measured against balance + profit, not profit alone.
 */
export function computeAdvancedStats(trades: readonly StatsTrade[], tz: string = DEFAULT_TIMEZONE, startBalance: number | null = null) {
  const stats = computeStats(trades);
  const profitFactor = stats.wins > 0 && stats.losses === 0 ? Infinity : stats.profitFactor;

  const base = startBalance !== null && startBalance > 0 ? startBalance : 0;
  let equity = base, peak = base;
  const drawdownCurve: DrawdownPoint[] = [];
  for (const t of byClosing(trades)) {
    equity += t.net_pnl ?? 0;
    peak = Math.max(peak, equity);
    const drawdownPct = peak > 0 ? ((equity - peak) / peak) * 100 : 0;
    const day = dayKeyOrNull(t.closed_at ?? null, tz) ?? String(t.closed_at).slice(0, 10);
    drawdownCurve.push({ date: day, equity: +(equity - base).toFixed(2), peak: +(peak - base).toFixed(2), drawdownPct: +drawdownPct.toFixed(2) });
  }

  // Day of a trade = day of its opening, as on the Overview calendar (see docs/architecture/trade-formulas.md, open questions).
  const dailyPnl: Record<string, number> = {};
  for (const t of trades) {
    if (!t.closed_at || !t.opened_at) continue;
    const day = dayKeyOrNull(t.opened_at, tz) ?? t.opened_at.slice(0, 10);
    dailyPnl[day] = +((dailyPnl[day] || 0) + (t.net_pnl ?? 0)).toFixed(2);
  }

  return {
    expectancy: +stats.expectancy.toFixed(2),
    expectancyR: stats.rCount ? +stats.avgR.toFixed(2) : null,
    profitFactor: profitFactor === Infinity ? profitFactor : +profitFactor.toFixed(2),
    maxDrawdownPct: maxDrawdown(trades, startBalance).pct ?? 0,
    drawdownCurve,
    rDistribution: rDistribution(trades),
    dailyPnl,
  };
}
