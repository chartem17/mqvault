import type { Trade } from "./trade-data";

export function computeStats(trades: Trade[]) {
  const wins = trades.filter(t => t.result_usd > 0);
  const losses = trades.filter(t => t.result_usd < 0);
  const be = trades.filter(t => t.result_usd === 0);
  const totalPnl = trades.reduce((s, t) => s + t.result_usd, 0);
  const grossWin = wins.reduce((s, t) => s + t.result_usd, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.result_usd, 0));
  return {
    total: trades.length,
    wins: wins.length,
    losses: losses.length,
    be: be.length,
    winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
    totalPnl,
    avgWin: wins.length ? grossWin / wins.length : 0,
    avgLoss: losses.length ? -(grossLoss / losses.length) : 0,
    avgR: trades.length ? trades.reduce((s, t) => s + t.result_r, 0) / trades.length : 0,
    profitFactor: grossLoss ? grossWin / grossLoss : 0,
    bestTrade: trades.length ? Math.max(...trades.map(t => t.result_usd)) : 0,
    worstTrade: trades.length ? Math.min(...trades.map(t => t.result_usd)) : 0,
  };
}

export function computeEquity(trades: Trade[]) {
  const sorted = [...trades].sort((a, b) =>
    `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
  );

  let cum = 0;

  return sorted.map((t, index) => {
    cum += t.result_usd;

    return {
      index,
      date: t.date,
      time: t.time,
      pair: t.pair,
      session: t.session,
      emotion: t.emotion,
      tradePnl: t.result_usd,
      resultR: t.result_r,
      pnl: +cum.toFixed(2),
    };
  });
}

export function groupByKey<K extends keyof Trade>(trades: Trade[], key: K) {
  const m: Record<string, { name: string; trades: number; pnl: number; wins: number }> = {};
  trades.forEach(t => {
    const k = String(t[key] || "—");
    if (!m[k]) m[k] = { name: k, trades: 0, pnl: 0, wins: 0 };
    m[k].trades++;
    m[k].pnl += t.result_usd;
    if (t.result_usd > 0) m[k].wins++;
  });
  return Object.values(m).map(x => ({
    name: x.name,
    trades: x.trades,
    pnl: +x.pnl.toFixed(2),
    wins: x.wins,
    winRate: +((x.wins / Math.max(1, x.trades)) * 100).toFixed(1),
  }));
}

export function computeMonthly(trades: Trade[]) {
  const m: Record<string, number> = {};
  trades.forEach(t => {
    const mo = t.date.slice(0, 7);
    if (mo) m[mo] = (m[mo] || 0) + t.result_usd;
  });
  return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0])).map(([month, pnl]) => ({ month, pnl: +pnl.toFixed(2) }));
}

export const fmt = {
  usd: (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2)}$`,
  pct: (v: number) => `${v.toFixed(1)}%`,
  r: (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2)}R`,
  num: (v: number, d = 2) => v.toFixed(d),
};