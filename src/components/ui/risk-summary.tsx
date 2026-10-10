"use client";

import { useMemo } from "react";
import { useTrades } from "@/hooks/use-trades";

export function RiskSummary() {
  const { visibleTrades } = useTrades();

  const risk = useMemo(() => {
    const values = visibleTrades
      .map((trade) => Number(trade.risk_percent))
      .filter((value) => Number.isFinite(value) && value > 0);

    if (!values.length) return null;

    return {
      average: values.reduce((sum, value) => sum + value, 0) / values.length,
      max: Math.max(...values),
      covered: values.length,
      total: visibleTrades.length,
    };
  }, [visibleTrades]);

  if (!risk) {
    return <span className="text-[11px] text-white/35">Risk data unavailable</span>;
  }

  return (
    <span className="text-[11px] text-white/40">
      Avg risk/trade: <span className="font-medium text-white/65">{risk.average.toFixed(2)}%</span>
      <span className="mx-1.5 text-white/20">·</span>
      Max risk: <span className="font-medium text-white/65">{risk.max.toFixed(2)}%</span>
      <span className="mx-1.5 text-white/20">·</span>
      <span>{risk.covered}/{risk.total} trades tracked</span>
    </span>
  );
}
