import type { JournalTrade } from "@/hooks/use-trades";

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number")
    return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function toDate(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toMonthKey(value: string | null | undefined) {
  const d = toDate(value);
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function toDateLabel(value: string | null | undefined) {
  const d = toDate(value);
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toTimeLabel(value: string | null | undefined) {
  const d = toDate(value);
  if (!d) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function sortByOpenedAt(a: JournalTrade, b: JournalTrade) {
  return (a.opened_at ?? "").localeCompare(b.opened_at ?? "");
}

export function computeStats(trades: JournalTrade[]) {
  const wins = trades.filter((t) => toNumber(t.net_pnl) > 0);
  const losses = trades.filter((t) => toNumber(t.net_pnl) < 0);
  const be = trades.filter((t) => toNumber(t.net_pnl) === 0);

  const totalPnl = trades.reduce((s, t) => s + toNumber(t.net_pnl), 0);
  const grossWin = wins.reduce((s, t) => s + toNumber(t.net_pnl), 0);
  const grossLoss = Math.abs(
    losses.reduce((s, t) => s + toNumber(t.net_pnl), 0),
  );

  return {
    total: trades.length,
    wins: wins.length,
    losses: losses.length,
    be: be.length,
    winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
    totalPnl,
    avgWin: wins.length ? grossWin / wins.length : 0,
    avgLoss: losses.length ? -(grossLoss / losses.length) : 0,
    avgR: trades.length
      ? trades.reduce((s, t) => s + toNumber(t.result_r), 0) / trades.length
      : 0,
    profitFactor: grossLoss ? grossWin / grossLoss : 0,
    bestTrade: trades.length
      ? Math.max(...trades.map((t) => toNumber(t.net_pnl)))
      : 0,
    worstTrade: trades.length
      ? Math.min(...trades.map((t) => toNumber(t.net_pnl)))
      : 0,
  };
}

export function computeEquity(trades: JournalTrade[]) {
  const sorted = [...trades].sort(sortByOpenedAt);

  let cum = 0;

  return sorted.map((t, index) => {
    const tradePnl = toNumber(t.net_pnl);
    cum += tradePnl;

    return {
      index,
      date: toDateLabel(t.opened_at),
      time: toTimeLabel(t.opened_at),
      pair: t.symbol ?? "",
      session: t.session ?? "",
      emotion: t.emotion ?? "",
      tradePnl,
      resultR: toNumber(t.result_r),
      pnl: +cum.toFixed(2),
    };
  });
}

export function groupByKey<K extends keyof JournalTrade>(
  trades: JournalTrade[],
  key: K,
) {
  const m: Record<
    string,
    { name: string; trades: number; pnl: number; wins: number }
  > = {};

  trades.forEach((t) => {
    const raw = t[key];
    const k = typeof raw === "string" && raw.trim() ? raw : "—";

    if (!m[k]) m[k] = { name: k, trades: 0, pnl: 0, wins: 0 };

    const pnl = toNumber(t.net_pnl);

    m[k].trades++;
    m[k].pnl += pnl;
    if (pnl > 0) m[k].wins++;
  });

  return Object.values(m).map((x) => ({
    name: x.name,
    trades: x.trades,
    pnl: +x.pnl.toFixed(2),
    wins: x.wins,
    winRate: +((x.wins / Math.max(1, x.trades)) * 100).toFixed(1),
  }));
}

export function computeMonthly(trades: JournalTrade[]) {
  const m: Record<string, number> = {};

  trades.forEach((t) => {
    const mo = toMonthKey(t.opened_at);
    if (!mo) return;
    m[mo] = (m[mo] || 0) + toNumber(t.net_pnl);
  });

  return Object.entries(m)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, pnl]) => ({ month, pnl: +pnl.toFixed(2) }));
}

export const fmt = {
  usd: (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2)}$`,
  pct: (v: number) => `${v.toFixed(1)}%`,
  r: (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2)}R`,
  num: (v: number, d = 2) => v.toFixed(d),
};
