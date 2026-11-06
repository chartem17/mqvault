"use client";

import { useMemo } from "react";
import { useTrades } from "@/hooks/use-trades";
import { useI18n } from "@/components/providers/i18n-provider";

export function RiskSummary() {
  const { visibleTrades } = useTrades();
  const { t, tn } = useI18n();

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
    return <span className="text-[11px] text-muted-foreground">{t("Risk data unavailable")}</span>;
  }

  return (
    <span className="text-[11px] text-muted-foreground">
      {t("Avg risk/trade:")} <span className="font-medium text-muted-foreground">{risk.average.toFixed(2)}%</span>
      <span className="mx-1.5 text-muted-foreground">·</span>
      {t("Max risk:")} <span className="font-medium text-muted-foreground">{risk.max.toFixed(2)}%</span>
      <span className="mx-1.5 text-muted-foreground">·</span>
      <span>{tn(risk.total, "{covered}/{count} trade tracked", "{covered}/{count} trades tracked", { covered: risk.covered })}</span>
    </span>
  );
}
