import type { AccountTrade } from "@/hooks/use-trades";

export type DrawdownPoint = {
  date: string;
  equity: number;
  peak: number;
  drawdownPct: number;
};

export type RBucket = { range: string; count: number };

export function computeAdvancedStats(trades: AccountTrade[]) {
  const wins = trades.filter((t) => (t.result_usd ?? 0) > 0);
  const losses = trades.filter((t) => (t.result_usd ?? 0) < 0);

  const winRate = trades.length ? wins.length / trades.length : 0;
  const lossRate = trades.length ? losses.length / trades.length : 0;
  const avgWin = wins.length
    ? wins.reduce((s, t) => s + (t.result_usd ?? 0), 0) / wins.length
    : 0;
  const avgLoss = losses.length
    ? Math.abs(losses.reduce((s, t) => s + (t.result_usd ?? 0), 0)) / losses.length
    : 0;

  const grossProfit = wins.reduce((s, t) => s + (t.result_usd ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.result_usd ?? 0), 0));

  const expectancy = winRate * avgWin - lossRate * avgLoss;
  const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? Infinity : 0) : grossProfit / grossLoss;

  let equity = 0;
  let peak = 0;
  let maxDrawdownPct = 0;
  const drawdownCurve: DrawdownPoint[] = [];

  const sorted = [...trades].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  for (const t of sorted) {
    equity += t.result_usd ?? 0;
    peak = Math.max(peak, equity);
    const drawdownPct = peak > 0 ? ((equity - peak) / peak) * 100 : 0;
    maxDrawdownPct = Math.min(maxDrawdownPct, drawdownPct);
    drawdownCurve.push({ date: t.date, equity, peak, drawdownPct: +drawdownPct.toFixed(2) });
  }

  const edges = [-Infinity, -2, -1, 0, 1, 2, 3, Infinity];
  const rDistribution: RBucket[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const lower = edges[i];
    const upper = edges[i + 1];
    const count = trades.filter((t) => {
      const r = t.result_r ?? 0;
      return r > lower && r <= upper;
    }).length;
    const label =
      lower === -Infinity ? `<${upper}R` : upper === Infinity ? `>${lower}R` : `${lower}..${upper}R`;
    rDistribution.push({ range: label, count });
  }

  const dailyPnl: Record<string, number> = {};
  for (const t of trades) {
    dailyPnl[t.date] = +((dailyPnl[t.date] || 0) + (t.result_usd ?? 0)).toFixed(2);
  }

  return {
    expectancy: +expectancy.toFixed(2),
    profitFactor: profitFactor === Infinity ? profitFactor : +profitFactor.toFixed(2),
    maxDrawdownPct: +maxDrawdownPct.toFixed(2),
    drawdownCurve,
    rDistribution,
    dailyPnl,
  };
}