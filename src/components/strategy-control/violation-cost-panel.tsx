"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/i18n-provider";
import { Hint } from "@/components/ui/hint";
import { PHONE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { STRATEGY_SURFACE } from "@/components/strategy-control/strategy-ui";
import { ruleEvaluators, ruleLibrary } from "@/lib/strategy-control/rule-library";
import { violationCost, type RuleViolations } from "@/lib/strategy-control/violation-cost";
import type { StrategyProfile, Trade } from "@/lib/strategy-control/types";

const CLEAN = "var(--color-chart-clean)", ACTUAL = "var(--color-chart-actual)";
const PAD = { top: 14, right: 12, bottom: 30, left: 52 };
const evaluate: RuleViolations = (ruleType, trades, params) => ruleEvaluators[ruleType]({ trades, params }).evidenceTrades;
const signed = (value: number) => (Math.abs(value) < 0.005 ? "0R" : `${value > 0 ? "+" : ""}${value.toFixed(2)}R`);
const dateLabel = (day: string) => { const [, month, date] = day.split("-"); return `${date}.${month}`; };

/** Smooth line through the points without overshooting between them (monotone cubic, Fritsch–Carlson). */
function smoothPath(points: [number, number][]): string {
  if (points.length < 3) return points.map(([px, py], index) => `${index ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join("");
  const n = points.length, dx: number[] = [], slope: number[] = [], tangent: number[] = [];
  for (let i = 0; i < n - 1; i += 1) { dx[i] = points[i + 1][0] - points[i][0]; slope[i] = dx[i] ? (points[i + 1][1] - points[i][1]) / dx[i] : 0; }
  tangent[0] = slope[0]; tangent[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i += 1) tangent[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  let d = `M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i += 1) {
    const third = dx[i] / 3;
    d += `C${(points[i][0] + third).toFixed(1)},${(points[i][1] + tangent[i] * third).toFixed(1)} ${(points[i + 1][0] - third).toFixed(1)},${(points[i + 1][1] - tangent[i + 1] * third).toFixed(1)} ${points[i + 1][0].toFixed(1)},${points[i + 1][1].toFixed(1)}`;
  }
  return d;
}

/** «Price of violations»: cumulative R as traded vs without the trades that broke an enabled rule. */
export function ViolationCostPanel({ trades, strategy }: { trades: Trade[]; strategy: StrategyProfile }) {
  const { t, tn } = useI18n();
  const router = useRouter();
  const cost = useMemo(() => violationCost(trades, strategy.rules, evaluate), [trades, strategy.rules]);
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const svg = useRef<SVGSVGElement | null>(null);
  // The chart is drawn in real pixels of its box, so text and lines keep their size on any screen.
  const frame = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, [cost.sample]);
  const phone = useMediaQuery(PHONE_QUERY);
  const W = Math.max(width, 240), H = phone ? 190 : 230;

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
  const line = (key: "actualR" | "cleanR") => smoothPath(points.map((point, index) => [x(index), y(point[key])]));
  // The shaded band between the two curves is what the violations cost (or earned).
  const band = points.length > 1 ? `${line("cleanR")}L${smoothPath(points.map((point, index) => [x(index), y(point.actualR)] as [number, number]).reverse()).slice(1)}Z` : "";
  // Max and min labels give way to the zero line when they would overlap it.
  const ticks = [...new Set([max, 0, min])].filter(value => value === 0 || Math.abs(y(value) - y(0)) >= 16);
  const middle = points.length > 2 ? Math.floor((points.length - 1) / 2) : null;

  function onMove(event: ReactPointerEvent<SVGSVGElement>) {
    const box = svg.current?.getBoundingClientRect();
    if (!box || !points.length) return;
    const px = event.clientX - box.left;
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
  const share = points.length ? cost.violatingTrades / points.length : 0;
  const worst = Math.max(...cost.byRule.map(item => Math.abs(item.resultR)), 0.01);

  return <section aria-label={t("Price of violations")} className={STRATEGY_SURFACE}>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:gap-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{t("Price of violations")}</div>
          {cost.sample === "small" && <Hint label={t("Fewer than 20 trades with R or fewer than 5 violations")}><span tabIndex={0} className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{t("Little data — tentative")}</span></Hint>}
        </div>
        <div className="mt-3 text-4xl font-semibold tracking-tight tabular-nums" style={{ color: cost.costR > 0 ? ACTUAL : cost.costR < 0 ? CLEAN : undefined }}>{cost.violatingTrades === 0 ? "0R" : signed(-cost.costR)}</div>
        <h2 className="mt-1 text-sm font-medium leading-snug text-foreground">{headline}</h2>

        <dl className="m-0 mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-border/70 bg-background/30 px-2.5 py-2"><dt className="flex items-start gap-1.5 text-[10px] uppercase leading-tight tracking-wider text-muted-foreground"><span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: CLEAN }} />{t("Following the rules")}</dt><dd className="m-0 mt-1 text-sm font-semibold tabular-nums">{signed(cost.cleanR)}</dd></div>
          <div className="rounded-xl border border-border/70 bg-background/30 px-2.5 py-2"><dt className="flex items-start gap-1.5 text-[10px] uppercase leading-tight tracking-wider text-muted-foreground"><span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: ACTUAL }} />{t("As traded")}</dt><dd className="m-0 mt-1 text-sm font-semibold tabular-nums">{signed(cost.actualR)}</dd></div>
          <div className="rounded-xl border border-border/70 bg-background/30 px-2.5 py-2"><dt className="text-[10px] uppercase leading-tight tracking-wider text-muted-foreground">{t("Broke a rule")}</dt><dd className="m-0 mt-1 text-sm font-semibold tabular-nums">{t("{count} of {total}", { count: cost.violatingTrades, total: points.length })}</dd>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true"><div className="h-full rounded-full" style={{ width: `${Math.round(share * 100)}%`, background: ACTUAL }} /></div></div>
        </dl>

        {cost.byRule.length > 0 && <div className="mt-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{t("By rule")}</div>
          <ul className="m-0 mt-2 list-none space-y-2.5 p-0">{cost.byRule.map(item => <li key={item.ruleType} className="text-xs">
            <div className="flex items-baseline justify-between gap-3"><span className="min-w-0 truncate text-foreground">{t(ruleLibrary[item.ruleType].title)} <span className="text-muted-foreground">· {tn(item.trades, "{count} trade", "{count} trades")}</span></span><span className="shrink-0 font-medium tabular-nums">{signed(item.resultR)}</span></div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true"><div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(3, Math.round((Math.abs(item.resultR) / worst) * 100))}%`, background: item.resultR < 0 ? ACTUAL : CLEAN }} /></div>
          </li>)}</ul>
          {cost.byRule.length > 1 && <p className="mt-2 text-[11px] leading-4 text-muted-foreground">{t("A trade that broke several rules is counted under each of them, so the rows can add up to more than the total.")}</p>}
        </div>}
      </div>

      <div className="min-w-0">
        <ul className="m-0 flex list-none flex-wrap gap-x-4 lg:justify-end gap-y-1 p-0 text-[11px] text-muted-foreground" aria-label={t("Legend")}>
          <li className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full" style={{ background: CLEAN }} aria-hidden="true" />{t("Following the rules")}</li>
          <li className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full" style={{ background: ACTUAL }} aria-hidden="true" />{t("As traded")}</li>
          <li className="flex items-center gap-1.5"><span className="h-2.5 w-0.5 rounded-full" style={{ background: ACTUAL }} aria-hidden="true" />{t("Trade that broke a rule")}</li>
        </ul>
        <div ref={frame} className="relative mt-2" style={{ height: H }}>
          {width > 0 && <svg ref={svg} width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("Cumulative R as traded and following the rules")} className="block touch-none select-none" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
            <defs>
              <linearGradient id="vc-band" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={ACTUAL} stopOpacity={0.22} /><stop offset="100%" stopColor={ACTUAL} stopOpacity={0.06} /></linearGradient>
            </defs>
            {ticks.map(value => <g key={value}><line x1={PAD.left} x2={W - PAD.right} y1={y(value)} y2={y(value)} stroke="currentColor" strokeOpacity={value === 0 ? 0.22 : 0.07} strokeDasharray={value === 0 ? undefined : "3 5"} /><text x={PAD.left - 8} y={y(value) + 4} textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">{signed(value)}</text></g>)}
            {band && <path d={band} fill="url(#vc-band)" />}
            <path d={line("actualR")} fill="none" stroke={ACTUAL} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            <path d={line("cleanR")} fill="none" stroke={CLEAN} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {points.map((point, index) => point.violated ? <line key={point.tradeId} x1={x(index)} x2={x(index)} y1={H - PAD.bottom + 5} y2={H - PAD.bottom + 11} stroke={ACTUAL} strokeWidth={2} strokeLinecap="round" opacity={hover === index ? 1 : 0.75} /> : null)}
            {active && hover !== null && <g pointerEvents="none"><line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} stroke="currentColor" strokeOpacity={0.25} strokeDasharray="2 3" /><circle cx={x(hover)} cy={y(active.actualR)} r={4} fill={ACTUAL} stroke="var(--color-card)" strokeWidth={2} /><circle cx={x(hover)} cy={y(active.cleanR)} r={4} fill={CLEAN} stroke="var(--color-card)" strokeWidth={2} /></g>}
            <text x={PAD.left} y={H - 4} className="fill-muted-foreground text-[11px]">{points[0] ? dateLabel(points[0].date) : ""}</text>
            {middle !== null && <text x={x(middle)} y={H - 4} textAnchor="middle" className="fill-muted-foreground text-[11px]">{dateLabel(points[middle].date)}</text>}
            <text x={W - PAD.right} y={H - 4} textAnchor="end" className="fill-muted-foreground text-[11px]">{points.length ? dateLabel(points[points.length - 1].date) : ""}</text>
          </svg>}
          {active && hover !== null && <div role="status" className="pointer-events-none absolute top-0 z-10 min-w-44 rounded-xl border border-border bg-popover/95 px-3 py-2 text-xs shadow-lg backdrop-blur" style={{ left: x(hover), transform: `translateX(${x(hover) > W / 2 ? "calc(-100% - 12px)" : "12px"})` }}>
            <div className="text-muted-foreground">{t("Trade {position} · {date}", { position: hover + 1, date: dateLabel(active.date) })}{active.violated ? ` · ${t("broke a rule")}` : ""}</div>
            <div className="mt-1 flex items-center gap-2"><span className="h-0.5 w-3 rounded-full" style={{ background: CLEAN }} aria-hidden="true" /><span className="font-semibold tabular-nums text-foreground">{signed(active.cleanR)}</span><span className="text-muted-foreground">{t("Following the rules")}</span></div>
            <div className="flex items-center gap-2"><span className="h-0.5 w-3 rounded-full" style={{ background: ACTUAL }} aria-hidden="true" /><span className="font-semibold tabular-nums text-foreground">{signed(active.actualR)}</span><span className="text-muted-foreground">{t("As traded")}</span></div>
          </div>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <button type="button" className="text-primary hover:underline" aria-expanded={table} onClick={() => setTable(!table)}>{table ? t("Hide table") : t("Show as table")}</button>
          {cost.violatingTrades > 0 && cost.violatingTrades <= 100 && <button type="button" className="text-primary hover:underline" onClick={() => router.push(`/journal?focusTradeIds=${encodeURIComponent(points.filter(point => point.violated).map(point => point.tradeId).join(","))}`)}>{t("Open violating trades in the journal")}</button>}
          <Hint label={`${t("“Following the rules” simply leaves out the trades that broke an enabled rule; nothing replaces them. Daily limits count only trades taken after the limit was reached.")}${cost.unknownR > 0 ? ` ${tn(cost.unknownR, "{count} trade without R is left out.", "{count} trades without R are left out.")}` : ""}`} side="top">
            <button type="button" aria-label={t("How it is counted")} className="ml-auto inline-flex items-center gap-1 rounded-full text-muted-foreground hover:text-foreground"><Info className="h-3.5 w-3.5" aria-hidden="true" />{t("How it is counted")}</button>
          </Hint>
        </div>
      </div>
    </div>

    {table && <div className="mt-4 max-h-72 overflow-auto rounded-xl border border-border"><table className="w-full text-xs tabular-nums">
      <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="px-3 py-2 font-medium">#</th><th className="px-3 py-2 font-medium">{t("Date")}</th><th className="px-3 py-2 font-medium">{t("As traded")}</th><th className="px-3 py-2 font-medium">{t("Following the rules")}</th><th className="px-3 py-2 font-medium">{t("Broke a rule")}</th></tr></thead>
      <tbody>{points.map((point, index) => <tr key={point.tradeId} className="border-b border-border/50"><td className="px-3 py-1.5">{index + 1}</td><td className="px-3 py-1.5">{dateLabel(point.date)}</td><td className="px-3 py-1.5">{signed(point.actualR)}</td><td className="px-3 py-1.5">{signed(point.cleanR)}</td><td className="px-3 py-1.5">{point.violated ? t("Yes") : "—"}</td></tr>)}</tbody>
    </table></div>}
  </section>;
}
