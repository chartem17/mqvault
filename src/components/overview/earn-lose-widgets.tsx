"use client";

import { useMemo, useState } from "react";
import { useTrades } from "@/hooks/use-trades";
import { useTimezone } from "@/components/providers/timezone-provider";
import { useI18n } from "@/components/providers/i18n-provider";
import { WidgetPanel } from "./widget-panel";
import { fmt } from "@/lib/journal/utils-trade";
import { SESSION_DEFINITIONS } from "@/lib/time/sessions";
import { msg } from "@/lib/i18n/core";
import { BREAKDOWN_DIMENSIONS, MIN_SAMPLE, breakdown, weekdayHourGrid, type BreakdownDimension, type HeatCell } from "@/lib/journal/performance-breakdown";

const GREEN = "var(--color-green)", RED = "var(--color-red)";
const DIMENSION_LABEL: Record<BreakdownDimension, string> = { symbol: msg("Symbol"), session: msg("Session"), weekday: msg("Weekday"), hour: msg("Hour"), setup: msg("Setup") };
const signedR = (value: number | null) => (value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}R`);
const tone = (value: number | null) => (value === null || value === 0 ? undefined : { color: value > 0 ? GREEN : RED });

/** Monday-first weekday names in the UI language (2024-01-01 was a Monday). */
function weekdayName(weekday: number, intl: string, style: "short" | "long" = "short") {
  return new Date(Date.UTC(2024, 0, weekday)).toLocaleDateString(intl, { weekday: style, timeZone: "UTC" });
}

/** "Where I earn / lose": one dimension at a time, R first, sample size always visible. */
export function EarnLoseWidget() {
  const { visibleTrades } = useTrades();
  const { timezone } = useTimezone();
  const { t, intl } = useI18n();
  const [dimension, setDimension] = useState<BreakdownDimension>("symbol");
  const rows = useMemo(() => breakdown(visibleTrades, dimension, timezone), [visibleTrades, dimension, timezone]);
  const maxAbs = Math.max(...rows.map(row => Math.abs(row.totalR)), 0.01);
  const label = (key: string) => {
    if (dimension === "weekday") return weekdayName(Number(key), intl);
    if (dimension === "hour") return `${key}:00`;
    if (dimension === "session") return t(SESSION_DEFINITIONS.find(session => session.key === key)?.label ?? key);
    if (dimension === "setup") return key ? t(key) : t("No setup");
    return key;
  };

  return <WidgetPanel title={t("Where I earn / lose")} sub={t("R per group · rows with fewer than {count} trades are dimmed · * some trades have no R", { count: MIN_SAMPLE })} scroll
    aside={<div role="radiogroup" aria-label={t("Group by")} className="flex flex-wrap gap-1">{BREAKDOWN_DIMENSIONS.map(item => <button key={item} type="button" role="radio" aria-checked={dimension === item} onClick={() => setDimension(item)} className={`min-h-8 rounded-full border px-2.5 text-xs transition-colors ${dimension === item ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"}`}>{t(DIMENSION_LABEL[item])}</button>)}</div>}>
    {rows.length === 0 ? <p className="text-sm text-muted-foreground">{t("No data.")}</p> : <table className="w-full text-xs tabular-nums">
      <thead className="sticky top-0 z-10 bg-card"><tr className="border-b border-border text-left text-muted-foreground">
        <th scope="col" className="py-2 pr-2 font-medium">{t(DIMENSION_LABEL[dimension])}</th>
        <th scope="col" className="px-2 py-2 text-right font-medium">{t("Trades")}</th>
        <th scope="col" className="hidden w-[28%] px-2 py-2 font-medium sm:table-cell">{t("Total R")}</th>
        <th scope="col" className="px-2 py-2 text-right font-medium">{t("Avg R")}</th>
        <th scope="col" className="px-2 py-2 text-right font-medium">{t("Win %")}</th>
        <th scope="col" className="py-2 pl-2 text-right font-medium">{t("Net P&L")}</th>
      </tr></thead>
      <tbody>{rows.map(row => <tr key={row.key} className={`border-b border-border/50 ${row.small ? "opacity-55" : ""}`} title={row.small ? t("Small sample") : undefined}>
        <th scope="row" className="max-w-[9rem] truncate py-2 pr-2 text-left font-normal text-foreground">{label(row.key)}</th>
        <td className="px-2 py-2 text-right" title={row.withR < row.trades ? t("{count} with a known R", { count: row.withR }) : undefined}>{row.trades}{row.withR < row.trades && <span className="text-muted-foreground">*</span>}</td>
        <td className="hidden px-2 py-2 sm:table-cell">
          <div className="flex items-center gap-2"><div className="relative h-2 flex-1" aria-hidden="true"><div className="absolute inset-y-0 left-1/2 w-px bg-border" />{row.withR > 0 && <div className="absolute inset-y-0 rounded-sm" style={{ background: row.totalR >= 0 ? GREEN : RED, width: `${(Math.abs(row.totalR) / maxAbs) * 50}%`, [row.totalR >= 0 ? "left" : "right"]: "50%" }} />}</div><span className="w-14 text-right" style={tone(row.withR ? row.totalR : null)}>{row.withR ? signedR(row.totalR) : "—"}</span></div>
        </td>
        <td className="px-2 py-2 text-right" style={tone(row.avgR)}>{signedR(row.avgR)}</td>
        <td className="px-2 py-2 text-right">{row.winRate === null ? "—" : `${Math.round(row.winRate)}%`}</td>
        <td className="py-2 pl-2 text-right" style={tone(row.net)}>{fmt.usd(row.net)}</td>
      </tr>)}</tbody>
    </table>}
  </WidgetPanel>;
}

/** Diverging fill for average R: red ↔ neutral ↔ green, capped at ±2R so one outlier does not wash out the rest. */
function cellFill(cell: HeatCell) {
  if (cell.avgR === null) return "color-mix(in oklch, var(--color-muted-foreground) 18%, transparent)";
  const strength = Math.min(Math.abs(cell.avgR) / 2, 1);
  return `color-mix(in oklch, ${cell.avgR >= 0 ? GREEN : RED} ${Math.round(15 + strength * 75)}%, transparent)`;
}

export function WeekdayHourWidget() {
  const { visibleTrades } = useTrades();
  const { timezone } = useTimezone();
  const { t, tn, intl } = useI18n();
  const cells = useMemo(() => weekdayHourGrid(visibleTrades, timezone), [visibleTrades, timezone]);
  const byId = useMemo(() => new Map(cells.map(cell => [`${cell.weekday}:${cell.hour}`, cell])), [cells]);
  const [active, setActive] = useState<HeatCell | null>(null);
  const describe = (cell: HeatCell) => `${weekdayName(cell.weekday, intl, "long")} ${String(cell.hour).padStart(2, "0")}:00 · ${tn(cell.trades, "{count} trade", "{count} trades")} · ${t("avg {value}", { value: signedR(cell.avgR) })}`;

  return <WidgetPanel title={t("Weekday × hour")} sub={<span role="status">{active ? describe(active) : t("Average R by opening time in your time zone")}</span>} scroll>
    {cells.length === 0 ? <p className="text-sm text-muted-foreground">{t("No data.")}</p> : <div className="min-w-[24rem]">
      <div role="grid" aria-label={t("Average R by weekday and hour")} className="grid gap-[2px]" style={{ gridTemplateColumns: "2.25rem repeat(24, minmax(0, 1fr))" }} onMouseLeave={() => setActive(null)}>
        <div role="row" className="contents">
          <span role="columnheader" />
          {Array.from({ length: 24 }, (_, hour) => <span key={hour} role="columnheader" className="text-center text-[10px] text-muted-foreground">{hour % 3 === 0 ? String(hour).padStart(2, "0") : ""}</span>)}
        </div>
        {Array.from({ length: 7 }, (_, index) => index + 1).map(weekday => <div key={weekday} role="row" className="contents">
          <span role="rowheader" className="pr-1 text-[11px] leading-6 text-muted-foreground">{weekdayName(weekday, intl)}</span>
          {Array.from({ length: 24 }, (_, hour) => {
            const cell = byId.get(`${weekday}:${hour}`);
            if (!cell) return <span key={hour} role="gridcell" aria-label={`${weekdayName(weekday, intl, "long")} ${String(hour).padStart(2, "0")}:00 · ${t("no trades")}`} className="h-6 rounded-[3px] bg-secondary/40" />;
            return <button key={hour} type="button" role="gridcell" aria-label={describe(cell)} onMouseEnter={() => setActive(cell)} onFocus={() => setActive(cell)} onBlur={() => setActive(null)}
              className={`h-6 rounded-[3px] text-[10px] font-medium text-foreground outline-offset-1 hover:outline hover:outline-2 hover:outline-foreground/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${cell.trades < MIN_SAMPLE ? "opacity-70" : ""}`}
              style={{ background: cellFill(cell) }}>{cell.trades}</button>;
          })}
        </div>)}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground" aria-hidden="true">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px]" style={{ background: `color-mix(in oklch, ${RED} 90%, transparent)` }} />−2R</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px]" style={{ background: "color-mix(in oklch, var(--color-muted-foreground) 18%, transparent)" }} />{t("no R")}</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px]" style={{ background: `color-mix(in oklch, ${GREEN} 90%, transparent)` }} />+2R</span>
        <span>{t("Number in a cell = trades")}</span>
      </div>
    </div>}
  </WidgetPanel>;
}
