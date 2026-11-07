"use client";

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/i18n-provider";
import { PHONE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { STRATEGY_SURFACE } from "@/components/strategy-control/strategy-ui";
import { ruleEvaluators, ruleLibrary } from "@/lib/strategy-control/rule-library";
import { violationCost, type RuleViolations } from "@/lib/strategy-control/violation-cost";
import type { StrategyProfile, Trade } from "@/lib/strategy-control/types";

const CLEAN = "var(--color-chart-clean)", ACTUAL = "var(--color-chart-actual)";
const PAD = { top: 12, right: 12, bottom: 24, left: 48 };
const evaluate: RuleViolations = (ruleType, trades, params) => ruleEvaluators[ruleType]({ trades, params }).evidenceTrades;
const signed = (value: number) => (Math.abs(value) < 0.005 ? "0R" : `${value > 0 ? "+" : ""}${value.toFixed(2)}R`);
const dateLabel = (day: string) => { const [, month, date] = day.split("-"); return `${date}.${month}`; };

/** «Price of violations»: cumulative R as traded vs without the trades that broke an enabled rule. */
export function ViolationCostPanel({ trades, strategy }: { trades: Trade[]; strategy: StrategyProfile }) {
  const { t, tn } = useI18n();
  const router = useRouter();
  const cost = useMemo(() => violationCost(trades, strategy.rules, evaluate), [trades, strategy.rules]);
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const svg = useRef<SVGSVGElement | null>(null);
  // A narrower frame on phones keeps axis text near its CSS size instead of shrinking with the viewBox.
  const phone = useMediaQuery(PHONE_QUERY);
  const W = phone ? 360 : 640, H = phone ? 220 : 240;

  if (cost.sample === "none") return <section aria-label={t("Price of violations")} className={STRATEGY_SURFACE}>
    <h2 className="m-0 text-lg font-semibold">{t("Price of violations")}</h2>
    <p className="mt-2 text-sm text-muted-foreground">{strategy.rules.some(rule => rule.enabled) ? t("No trades with a known R in this period.") : t("The strategy has no active rules.")}</p>
  </section>;

  const points = cost.points;
  const values = points.flatMap(point => [point.actualR, point.cleanR]);
  const min = Math.min(0, ...values), max = Math.max(0, ...values);
  const span = max - min || 1;
  const innerW = W - PAD.left - PAD.right, innerH = H - PAD.top - PAD.bottom;
  const x = (index: number) => PAD.left + (points.length > 1 ? (index / (points.length - 1)) * innerW : innerW / 2);
  const y = (value: number) => PAD.top + ((max - value) / span) * innerH;
  const path = (key: "actualR" | "cleanR") => points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(point[key]).toFixed(1)}`).join("");
  // min ≤ 0 ≤ max always, so the zero line is a labelled tick; duplicates collapse when a curve never leaves zero.
  const ticks = [...new Set([max, 0, min])];

  function onMove(event: ReactPointerEvent<SVGSVGElement>) {
    const box = svg.current?.getBoundingClientRect();
    if (!box || !points.length) return;
    const px = ((event.clientX - box.left) / box.width) * W;
    const index = points.length > 1 ? Math.round(((px - PAD.left) / innerW) * (points.length - 1)) : 0;
    setHover(Math.min(Math.max(index, 0), points.length - 1));
  }
  const active = hover === null ? null : points[hover];

  const headline = cost.violatingTrades === 0
    ? t("No violations among trades with a known R in this period.")
    : cost.costR > 0
      ? t("Violations cost {value} in this period", { value: signed(cost.costR).replace("+", "") })
      : cost.costR < 0
        ? t("Trades that broke the rules made {value} in this period", { value: signed(-cost.costR) })
        : t("Trades that broke the rules ended at zero in this period");

  return <section aria-label={t("Price of violations")} className={STRATEGY_SURFACE}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{t("Price of violations")}</div>
        <h2 className="mt-2 text-xl font-semibold text-foreground sm:text-2xl">{headline}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("As traded {actual} · following the rules {clean} · {count} of {total} trades broke a rule", { actual: signed(cost.actualR), clean: signed(cost.cleanR), count: cost.violatingTrades, total: points.length })}</p>
      </div>
      {cost.sample === "small" && <span className="rounded-full border border-border bg-muted/40 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground" title={t("Fewer than 20 trades with R or fewer than 5 violations")}>{t("Little data — tentative")}</span>}
    </div>

    <ul className="m-0 mt-4 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-xs text-muted-foreground" aria-label={t("Legend")}>
      <li className="flex items-center gap-2"><svg width="18" height="6" aria-hidden="true"><line x1="0" y1="3" x2="18" y2="3" stroke={CLEAN} strokeWidth="2" strokeLinecap="round" /></svg>{t("Following the rules")}</li>
      <li className="flex items-center gap-2"><svg width="18" height="6" aria-hidden="true"><line x1="0" y1="3" x2="18" y2="3" stroke={ACTUAL} strokeWidth="2" strokeLinecap="round" /></svg>{t("As traded")}</li>
      <li className="flex items-center gap-2"><svg width="10" height="10" aria-hidden="true"><circle cx="5" cy="5" r="4" fill={ACTUAL} stroke="var(--color-card)" strokeWidth="2" /></svg>{t("Trade that broke a rule")}</li>
    </ul>

    <div className="relative mt-2">
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("Cumulative R as traded and following the rules")} className="block h-auto w-full touch-none select-none" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
        {ticks.map(value => <g key={value}><line x1={PAD.left} x2={W - PAD.right} y1={y(value)} y2={y(value)} stroke="currentColor" strokeOpacity={value === 0 ? 0.25 : 0.08} strokeDasharray={value === 0 ? undefined : "2 4"} /><text x={PAD.left - 8} y={y(value) + 4} textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">{signed(value)}</text></g>)}
        <path d={path("actualR")} fill="none" stroke={ACTUAL} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <path d={path("cleanR")} fill="none" stroke={CLEAN} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point, index) => point.violated ? <circle key={point.tradeId} cx={x(index)} cy={y(point.actualR)} r={4} fill={ACTUAL} stroke="var(--color-card)" strokeWidth={2} /> : null)}
        {active && hover !== null && <g pointerEvents="none"><line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} stroke="currentColor" strokeOpacity={0.3} /><circle cx={x(hover)} cy={y(active.actualR)} r={4} fill={ACTUAL} stroke="var(--color-card)" strokeWidth={2} /><circle cx={x(hover)} cy={y(active.cleanR)} r={4} fill={CLEAN} stroke="var(--color-card)" strokeWidth={2} /></g>}
        <text x={PAD.left} y={H - 6} className="fill-muted-foreground text-[11px]">{points[0] ? dateLabel(points[0].date) : ""}</text>
        <text x={W - PAD.right} y={H - 6} textAnchor="end" className="fill-muted-foreground text-[11px]">{points.length ? dateLabel(points[points.length - 1].date) : ""}</text>
      </svg>
      {active && hover !== null && <div role="status" className="pointer-events-none absolute top-0 z-10 min-w-44 rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-lg" style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${x(hover) > W / 2 ? "calc(-100% - 12px)" : "12px"})` }}>
        <div className="text-muted-foreground">{t("Trade {position} · {date}", { position: hover + 1, date: dateLabel(active.date) })}{active.violated ? ` · ${t("broke a rule")}` : ""}</div>
        <div className="mt-1 flex items-center gap-2"><svg width="12" height="4" aria-hidden="true"><line x1="0" y1="2" x2="12" y2="2" stroke={CLEAN} strokeWidth="2" /></svg><span className="font-semibold tabular-nums text-foreground">{signed(active.cleanR)}</span><span className="text-muted-foreground">{t("Following the rules")}</span></div>
        <div className="flex items-center gap-2"><svg width="12" height="4" aria-hidden="true"><line x1="0" y1="2" x2="12" y2="2" stroke={ACTUAL} strokeWidth="2" /></svg><span className="font-semibold tabular-nums text-foreground">{signed(active.actualR)}</span><span className="text-muted-foreground">{t("As traded")}</span></div>
      </div>}
    </div>

    {cost.byRule.length > 0 && <div className="mt-5">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{t("By rule")}</div>
      <ul className="m-0 mt-2 list-none divide-y divide-border/60 p-0">{cost.byRule.map(item => <li key={item.ruleType} className="flex items-baseline justify-between gap-4 py-2 text-sm">
        <span className="min-w-0 truncate">{t(ruleLibrary[item.ruleType].title)} <span className="text-muted-foreground">· {tn(item.trades, "{count} trade", "{count} trades")}</span></span>
        <span className="tabular-nums text-foreground">{signed(item.resultR)}</span>
      </li>)}</ul>
      {cost.byRule.length > 1 && <p className="mt-1 text-xs text-muted-foreground">{t("A trade that broke several rules is counted under each of them, so the rows can add up to more than the total.")}</p>}
    </div>}

    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
      <button type="button" className="text-primary hover:underline" aria-expanded={table} onClick={() => setTable(!table)}>{table ? t("Hide table") : t("Show as table")}</button>
      {cost.violatingTrades > 0 && cost.violatingTrades <= 100 && <button type="button" className="text-primary hover:underline" onClick={() => router.push(`/journal?focusTradeIds=${encodeURIComponent(points.filter(point => point.violated).map(point => point.tradeId).join(","))}`)}>{t("Open violating trades in the journal")}</button>}
    </div>
    {table && <div className="mt-3 max-h-72 overflow-auto rounded-xl border border-border"><table className="w-full text-xs tabular-nums">
      <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="px-3 py-2 font-medium">#</th><th className="px-3 py-2 font-medium">{t("Date")}</th><th className="px-3 py-2 font-medium">{t("As traded")}</th><th className="px-3 py-2 font-medium">{t("Following the rules")}</th><th className="px-3 py-2 font-medium">{t("Broke a rule")}</th></tr></thead>
      <tbody>{points.map((point, index) => <tr key={point.tradeId} className="border-b border-border/50"><td className="px-3 py-1.5">{index + 1}</td><td className="px-3 py-1.5">{dateLabel(point.date)}</td><td className="px-3 py-1.5">{signed(point.actualR)}</td><td className="px-3 py-1.5">{signed(point.cleanR)}</td><td className="px-3 py-1.5">{point.violated ? t("Yes") : "—"}</td></tr>)}</tbody>
    </table></div>}

    <p className="mt-4 text-xs leading-5 text-muted-foreground">{t("“Following the rules” simply leaves out the trades that broke an enabled rule; nothing replaces them. Daily limits count only trades taken after the limit was reached.")}{cost.unknownR > 0 ? ` ${tn(cost.unknownR, "{count} trade without R is left out.", "{count} trades without R are left out.")}` : ""}</p>
  </section>;
}
