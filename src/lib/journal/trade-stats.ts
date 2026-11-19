/**
 * Dashboard aggregates over stored trades (ADR 0020). Pure; net and R are taken as stored (ADR 0003).
 *
 * - Only closed trades count: an open trade has no result yet.
 * - Money figures use every closed trade with a net; R figures use only trades with a known R. A missing R is
 *   missing, never 0R: counting it as zero hides wins whose stop was moved to break-even.
 * - Win = net > 0, loss = net < 0, break-even = 0; win rate is wins / closed trades with a net.
 */
export type StatsTrade = { opened_at?: string | null; closed_at?: string | null; net_pnl?: number | null; result_r?: number | null };

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
export const isClosed = (trade: StatsTrade) => Boolean(trade.closed_at);

export function computeStats(trades: readonly StatsTrade[]) {
  const closed = trades.filter(trade => isClosed(trade) && finite(trade.net_pnl));
  const nets = closed.map(trade => trade.net_pnl as number);
  const wins = nets.filter(net => net > 0), losses = nets.filter(net => net < 0);
  const rs = trades.filter(isClosed).map(trade => trade.result_r).filter(finite);
  const grossWin = wins.reduce((sum, net) => sum + net, 0);
  const grossLoss = Math.abs(losses.reduce((sum, net) => sum + net, 0));
  return {
    total: closed.length,
    wins: wins.length,
    losses: losses.length,
    be: nets.length - wins.length - losses.length,
    winRate: nets.length ? (wins.length / nets.length) * 100 : 0,
    totalPnl: nets.reduce((sum, net) => sum + net, 0),
    avgWin: wins.length ? grossWin / wins.length : 0,
    avgLoss: losses.length ? -(grossLoss / losses.length) : 0,
    /** Average R per trade with a known R (= expectancy in R). */
    avgR: rs.length ? rs.reduce((sum, r) => sum + r, 0) / rs.length : 0,
    /** How many trades avgR is based on. */
    rCount: rs.length,
    /** Average net per closed trade (= expectancy in money). */
    expectancy: nets.length ? nets.reduce((sum, net) => sum + net, 0) / nets.length : 0,
    profitFactor: grossLoss ? grossWin / grossLoss : 0,
    bestTrade: nets.length ? Math.max(...nets) : 0,
    worstTrade: nets.length ? Math.min(...nets) : 0,
  };
}

export type RBucket = { range: string; count: number };

/** R histogram of closed trades with a known R. */
export function rDistribution(trades: readonly StatsTrade[]): RBucket[] {
  const rs = trades.filter(isClosed).map(trade => trade.result_r).filter(finite);
  const edges = [-Infinity, -2, -1, 0, 1, 2, 3, Infinity];
  const buckets: RBucket[] = [];
  for (let index = 0; index < edges.length - 1; index++) {
    const lower = edges[index], upper = edges[index + 1];
    const label = lower === -Infinity ? `<${upper}R` : upper === Infinity ? `>${lower}R` : `${lower}..${upper}R`;
    buckets.push({ range: label, count: rs.filter(r => r > lower && r <= upper).length });
  }
  return buckets;
}

/** Realised P&L belongs to the moment it was realised: closed trades in closing order. */
export function byClosing<T extends StatsTrade>(trades: readonly T[]): T[] {
  return trades.filter(isClosed).sort((a, b) => Date.parse(a.closed_at as string) - Date.parse(b.closed_at as string));
}

/**
 * Deepest fall from a running equity peak. Equity starts at `startBalance` (0 when unknown), so a losing start is a
 * drawdown too; the percentage is of the peak equity (balance + profit), not of the profit alone.
 */
export function maxDrawdown(trades: readonly StatsTrade[], startBalance: number | null = null): { amount: number; pct: number | null } {
  const base = finite(startBalance) && startBalance > 0 ? startBalance : 0;
  let equity = base, peak = base, amount = 0, pct: number | null = base > 0 ? 0 : null;
  for (const trade of byClosing(trades)) {
    equity += finite(trade.net_pnl) ? trade.net_pnl : 0;
    peak = Math.max(peak, equity);
    amount = Math.min(amount, equity - peak);
    if (base > 0 && peak > 0) pct = Math.min(pct ?? 0, ((equity - peak) / peak) * 100);
  }
  return { amount: Math.round(amount * 100) / 100, pct: pct === null ? null : Math.round(pct * 100) / 100 };
}
