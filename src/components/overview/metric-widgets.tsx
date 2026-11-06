"use client";

import { useMemo } from "react";
import { useTrades } from "@/hooks/use-trades";
import { computeStats, fmt } from "@/lib/utils-trade";
import { StatCard } from "@/components/ui/stat-card";

type Stats = ReturnType<typeof computeStats>;
function useStats(): Stats {
  const { visibleTrades } = useTrades();
  return useMemo(() => computeStats(visibleTrades), [visibleTrades]);
}
const tone = (positive: boolean) => positive ? "text-green" : "text-red";
const CELL = "h-full justify-center";

export function NetPnlWidget() { const s = useStats(); return <StatCard className={CELL} label="Net P&L" value={fmt.usd(s.totalPnl)} colorClass={tone(s.totalPnl >= 0)} />; }
export function WinrateWidget() { const s = useStats(); return <StatCard className={CELL} label="Winrate" value={fmt.pct(s.winRate)} colorClass={tone(s.winRate >= 50)} />; }
export function AvgRWidget() { const s = useStats(); return <StatCard className={CELL} label="Avg R" value={fmt.r(s.avgR)} colorClass={tone(s.avgR >= 0)} />; }
export function ProfitFactorWidget() { const s = useStats(); return <StatCard className={CELL} label="Profit factor" value={fmt.num(s.profitFactor, 2)} colorClass={tone(s.profitFactor >= 1)} />; }
export function BestTradeWidget() { const s = useStats(); return <StatCard className={CELL} label="Best trade" value={fmt.usd(s.bestTrade)} colorClass={tone(s.bestTrade >= 0)} />; }
export function WorstTradeWidget() { const s = useStats(); return <StatCard className={CELL} label="Worst trade" value={fmt.usd(s.worstTrade)} colorClass={tone(s.worstTrade >= 0)} />; }
export function AvgWinWidget() { const s = useStats(); return <StatCard className={CELL} label="Avg win" value={fmt.usd(s.avgWin)} colorClass={tone(s.avgWin >= 0)} />; }
export function AvgLossWidget() { const s = useStats(); return <StatCard className={CELL} label="Avg loss" value={fmt.usd(s.avgLoss)} colorClass={tone(s.avgLoss >= 0)} />; }
