"use client";

import { useMemo } from "react";
import { useTrades, type JournalTrade } from "@/hooks/use-trades";
import { computeMonthly, fmt, groupByKey } from "@/lib/utils-trade";
import { LIST_ROW } from "@/components/ui/overview-styles";
import { SESSION_DEFINITIONS, SESSION_GROUPS, getSessionKey, getSessionLabel } from "@/lib/sessions";
import { useTimezone } from "@/components/providers/timezone-provider";
import { WidgetPanel } from "./widget-panel";

const GREEN = "var(--color-green)";
const RED = "var(--color-red)";
const EMPTY = <div className="text-sm text-muted-foreground">Немає даних.</div>;
const money = (pnl: number) => ({ color: pnl >= 0 ? GREEN : RED });

function sessionKeyOf(trade: JournalTrade) { try { return getSessionKey(trade.opened_at); } catch { return null; } }
function sessionGroupOf(trade: JournalTrade) { const key = sessionKeyOf(trade); return key ? SESSION_DEFINITIONS.find(session => session.key === key)?.group ?? "off" : "off"; }

export function MonthlyWidget() {
  const { visibleTrades } = useTrades();
  const { timezone } = useTimezone();
  const monthly = useMemo(() => computeMonthly(visibleTrades, timezone), [visibleTrades, timezone]);
  const max = Math.max(...monthly.map(item => Math.abs(item.pnl)), 1);
  return <WidgetPanel title="Monthly P&L" scroll bodyClassName="space-y-3">
    {monthly.length ? monthly.map(item => { const positive = item.pnl >= 0; return <div key={item.month} className="space-y-1.5"><div className="flex items-center justify-between gap-3 text-sm"><span className="text-muted-foreground">{item.month}</span><span style={money(item.pnl)}>{fmt.usd(item.pnl)}</span></div><div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full" style={{ width: `${Math.abs(item.pnl) / max * 100}%`, background: positive ? GREEN : RED }} /></div></div>; }) : EMPTY}
  </WidgetPanel>;
}

export function SymbolsWidget() {
  const { visibleTrades } = useTrades();
  const byPair = useMemo(() => groupByKey(visibleTrades, "symbol").sort((a, b) => b.pnl - a.pnl), [visibleTrades]);
  return <WidgetPanel title="Top symbols" scroll bodyClassName="space-y-3">
    {byPair.length ? byPair.map(item => <div key={item.name} className={LIST_ROW}><div className="min-w-0"><div className="truncate text-sm text-foreground">{item.name || "—"}</div><div className="text-xs text-muted-foreground">{item.trades} trades · WR {fmt.pct(item.winRate)}</div></div><div className="shrink-0 text-sm font-medium" style={money(item.pnl)}>{fmt.usd(item.pnl)}</div></div>) : EMPTY}
  </WidgetPanel>;
}

type Bucket = { label: string; pnl: number; trades: number; wins: number };
function collect(trades: readonly JournalTrade[], keyOf: (trade: JournalTrade) => string | null, labelOf: (trade: JournalTrade, key: string) => string) {
  const groups = new Map<string, Bucket>();
  for (const trade of trades) {
    const key = keyOf(trade); if (!key) continue;
    const current = groups.get(key) ?? { label: labelOf(trade, key), pnl: 0, trades: 0, wins: 0 };
    current.pnl += trade.net_pnl ?? 0; current.trades += 1; if ((trade.net_pnl ?? 0) > 0) current.wins += 1;
    groups.set(key, current);
  }
  return [...groups.entries()].map(([key, value]) => ({ key, ...value })).sort((a, b) => b.pnl - a.pnl);
}

export function SessionsWidget() {
  const { visibleTrades } = useTrades();
  const bySession = useMemo(() => collect(visibleTrades, sessionGroupOf, (_trade, key) => SESSION_GROUPS.find(item => item.key === key)?.label ?? "Off hours"), [visibleTrades]);
  const bySubSession = useMemo(() => collect(visibleTrades, sessionKeyOf, trade => getSessionLabel(trade.opened_at)), [visibleTrades]);
  return <WidgetPanel title="Sessions" scroll>
    <div className="space-y-3">{bySession.length ? bySession.map(item => <div key={item.key} className={LIST_ROW}><div className="min-w-0"><div className="truncate text-sm text-foreground">{item.label}</div><div className="text-xs text-muted-foreground">{item.trades} trades · WR {item.trades ? Math.round(item.wins / item.trades * 100) : 0}%</div></div><div className="shrink-0 text-sm font-medium" style={money(item.pnl)}>{fmt.usd(item.pnl)}</div></div>) : EMPTY}</div>
    {bySubSession.length > 0 && <><div className="mt-4 text-xs text-muted-foreground">Деталі сесій</div><div className="mt-2 flex flex-wrap gap-2">{bySubSession.map(item => <span key={item.key} className="rounded-full border border-border bg-secondary/30 px-3 py-1 text-xs text-foreground">{item.label} · {item.trades} · {fmt.usd(item.pnl)}</span>)}</div></>}
  </WidgetPanel>;
}

export function EmotionsWidget() {
  const { visibleTrades } = useTrades();
  const byEmotion = useMemo(() => groupByKey(visibleTrades, "emotion").sort((a, b) => b.trades - a.trades), [visibleTrades]);
  return <WidgetPanel title="Emotions" scroll bodyClassName="space-y-3">
    {byEmotion.length ? byEmotion.map(item => <div key={item.name} className={LIST_ROW}><div className="min-w-0"><div className="truncate text-sm text-foreground">{item.name || "—"}</div><div className="text-xs text-muted-foreground">{item.trades} угод</div></div><div className="shrink-0 text-sm font-medium" style={money(item.pnl)}>{fmt.usd(item.pnl)}</div></div>) : EMPTY}
  </WidgetPanel>;
}
