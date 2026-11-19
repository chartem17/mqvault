"use client";

import { useMemo } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { fmt } from "@/lib/journal/utils-trade";
import type { PlaybookConfig } from "@/lib/playbook/config";
import { disciplinePeriods, disciplineSummary, type DisciplineSummary, type DisciplineTrade, type TradeAssessment } from "@/lib/playbook/discipline";

const DISPLAY = { fontFamily: "var(--font-home-display), var(--font-ui), system-ui, sans-serif" } as const;
const tone = (value: number) => value === 0 ? "" : value > 0 ? "text-green" : "text-red";

function Share({ label, summary }: { label: string; summary: DisciplineSummary }) {
  const { t, tn } = useI18n();
  const pct = summary.onPlanPct;
  return <div className="min-w-[9rem] space-y-1">
    <p className={`m-0 text-[2.2rem] font-medium leading-none tabular-nums ${pct === null ? "text-muted-foreground" : pct >= 80 ? "text-green" : pct >= 50 ? "text-gold" : "text-red"}`} style={DISPLAY}>{pct === null ? "—" : `${pct}%`}</p>
    <p className="m-0 text-xs text-muted-foreground">{label} · {tn(summary.trades, "{count} trade", "{count} trades")}</p>
    <p className="m-0 text-xs text-muted-foreground">{t("{on} on plan", { on: summary.onPlan })}</p>
  </div>;
}

function Row({ label, count, r, net }: { label: string; count: number; r: number; net?: number }) {
  return <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-x-4 py-1.5 text-sm sm:grid-cols-[minmax(0,1fr)_3rem_5rem_6rem]">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="m-0 hidden text-right tabular-nums text-muted-foreground sm:block">{count}</dd>
    <dd className={`m-0 text-right tabular-nums ${tone(r)}`}>{fmt.r(r)}</dd>
    {net !== undefined ? <dd className={`m-0 text-right tabular-nums ${tone(net)}`}>{fmt.usd(net)}</dd> : <dd className="m-0" />}
  </div>;
}

/**
 * Main discipline numbers, shown above P&L: share of trades on plan this week and month, how trades on plan
 * did against the rest, and the "stagnation" trades (held through a stall to SL/TP).
 */
export function DisciplineMetrics({ trades, assessed, config, now }: { trades: readonly DisciplineTrade[]; assessed: ReadonlyMap<string, TradeAssessment>; config: PlaybookConfig; now: Date }) {
  const { t } = useI18n();
  const { week, month } = useMemo(() => {
    const periods = disciplinePeriods(now.getTime(), config.timezone);
    return { week: disciplineSummary(trades, assessed, periods.week.from, periods.week.to), month: disciplineSummary(trades, assessed, periods.month.from, periods.month.to) };
  }, [trades, assessed, config.timezone, now]);
  const off = month.trades - month.onPlan;

  return <section aria-label={t("Discipline")} className="space-y-5">
    <h2 className="m-0 text-base font-semibold">{t("Discipline: trades on plan")}</h2>
    <div className="flex flex-wrap gap-x-14 gap-y-6 pt-1">
      <Share label={t("This week")} summary={week} />
      <Share label={t("This month")} summary={month} />
    </div>
    {month.trades > 0 && <div className="max-w-xl"><p className="m-0 pb-1 text-xs text-muted-foreground">{t("This month")}</p><dl className="m-0 divide-y divide-border/60">
      <Row label={t("On plan")} count={month.onPlan} r={month.onPlanR} net={month.onPlanNet} />
      <Row label={t("Off plan")} count={off} r={month.offPlanR} net={month.offPlanNet} />
      <Row label={t("Stagnation (held to SL/TP)")} count={month.stagnation} r={month.stagnationR} />
    </dl></div>}
  </section>;
}
