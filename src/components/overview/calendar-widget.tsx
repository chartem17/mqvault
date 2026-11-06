"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTrades } from "@/hooks/use-trades";
import { fmt } from "@/lib/utils-trade";
import { CARD_TITLE } from "@/components/ui/overview-styles";
import { dayKey } from "@/lib/timezone";
import { useTimezone } from "@/components/providers/timezone-provider";
import { calendarCellKey, zonedDayOrNull, zonedMonthCursor } from "@/lib/trading-calendar";
import { WidgetPanel } from "./widget-panel";
import { useI18n } from "@/components/providers/i18n-provider";

const GREEN = "var(--color-green)";
const RED = "var(--color-red)";
type CalendarTrade = { date: string; symbol?: string; direction?: "Long" | "Short" | string; net_pnl?: number; result_r?: number };
function TradesCalendar({ trades, timezone }: { trades: CalendarTrade[]; timezone: string }) {
  const [cursor, setCursor] = useState(() => zonedMonthCursor(timezone));
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const { t, intl } = useI18n();
  const monthLabel = cursor.toLocaleString(intl, { month: "long", year: "numeric" });
  // Sunday-first short weekday names in the UI language (4 Jan 2026 is a Sunday).
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => new Date(2026, 0, 4 + index).toLocaleString(intl, { weekday: "short" })), [intl]);
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const dayMap = useMemo(() => { const map: Record<string, { pnl: number; trades: CalendarTrade[] }> = {}; for (const trade of Array.isArray(trades) ? trades : []) { const key = trade.date; if (!key) continue; if (!map[key]) map[key] = { pnl: 0, trades: [] }; map[key].pnl += trade.net_pnl ?? 0; map[key].trades.push(trade); } return map; }, [trades]);
  const firstOfMonth = new Date(year, month, 1), startDate = new Date(firstOfMonth); startDate.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());
  const days = Array.from({ length: 42 }, (_, index) => { const date = new Date(startDate); date.setDate(startDate.getDate() + index); return { date, inMonth: date.getMonth() === month, key: calendarCellKey(date) }; });
  const todayKey = dayKey(new Date(), timezone);
  const isToday = (date: Date) => calendarCellKey(date) === todayKey;
  const selectedDay = selectedKey ? dayMap[selectedKey] : null;
  return <WidgetPanel title={t("Trade calendar")} sub={t("Tap a day with trades")} scroll aside={<div className="flex items-center gap-2"><button type="button" onClick={() => { setCursor(new Date(year, month - 1, 1)); setSelectedKey(null); }} className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary/30" aria-label={t("Previous month")}><ChevronLeft className="h-4 w-4" /></button><div className="min-w-[7.5rem] text-center text-sm text-foreground sm:min-w-[140px]">{monthLabel}</div><button type="button" onClick={() => { setCursor(new Date(year, month + 1, 1)); setSelectedKey(null); }} className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary/30" aria-label={t("Next month")}><ChevronRight className="h-4 w-4" /></button></div>}>
    <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">{weekDays.map(day => <div key={day} className="py-1">{day}</div>)}</div>
    <div className="mt-1 grid grid-cols-7 gap-1">{days.map(day => { const info = dayMap[day.key], hasTrade = day.inMonth && !!info, isSelected = selectedKey === day.key; return <button key={day.key} type="button" onClick={() => setSelectedKey(isSelected ? null : hasTrade ? day.key : null)} className={`relative flex min-h-[54px] flex-col items-center justify-center rounded-md py-1 text-[11px] transition-colors ${!day.inMonth ? "cursor-default text-muted-foreground" : hasTrade ? "cursor-pointer text-foreground hover:bg-secondary/30" : "cursor-default text-muted-foreground"} ${isToday(day.date) ? "font-bold" : ""} ${isSelected ? "bg-accent" : ""}`}><span>{day.date.getDate()}</span>{hasTrade ? <span className="mt-1 text-[10px]" style={{ color: info.pnl >= 0 ? GREEN : RED }}>{info.pnl >= 0 ? "+" : ""}{Math.abs(info.pnl) >= 1000 ? `${(info.pnl / 1000).toFixed(1)}k` : info.pnl.toFixed(0)}</span> : null}</button>; })}</div>
    <div className="mt-4 flex items-center gap-4 text-[11px] text-muted-foreground"><div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: GREEN }} /><span>{t("Profit")}</span></div><div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: RED }} /><span>{t("Loss")}</span></div><div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-secondary0" /><span>{t("Today")}</span></div></div>
    {selectedDay ? <div className="mt-4 rounded-xl border border-border bg-secondary/30 p-4"><div className="mb-3 flex items-center justify-between gap-3"><div><div className={CARD_TITLE}>{selectedKey}</div><div className="mt-1 text-xs" style={{ color: selectedDay.pnl >= 0 ? GREEN : RED }}>{fmt.usd(selectedDay.pnl)}</div></div><button type="button" onClick={() => setSelectedKey(null)} className="text-sm leading-none text-muted-foreground transition-colors hover:text-foreground" aria-label={t("Close day")}>×</button></div><div className="space-y-2">{selectedDay.trades.map((trade, index) => <div key={`${trade.date}-${trade.symbol}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2"><div className="min-w-0"><div className="truncate text-sm text-foreground">{trade.symbol || "—"}</div><div className="text-xs text-muted-foreground">{trade.direction || "—"}{typeof trade.result_r === "number" ? ` · ${trade.result_r.toFixed(1)}R` : ""}</div></div><div className="shrink-0 text-sm font-medium" style={{ color: (trade.net_pnl ?? 0) >= 0 ? GREEN : RED }}>{fmt.usd(trade.net_pnl ?? 0)}</div></div>)}</div></div> : null}
  </WidgetPanel>;
}

export function CalendarWidget() {
  const { visibleTrades } = useTrades();
  const { timezone } = useTimezone();
  const trades = useMemo<CalendarTrade[]>(() => visibleTrades.flatMap(trade => { const date = zonedDayOrNull(trade.opened_at, timezone); return date ? [{ date, symbol: trade.symbol, direction: trade.direction, net_pnl: trade.net_pnl ?? 0, result_r: trade.result_r ?? undefined }] : []; }), [visibleTrades, timezone]);
  return <TradesCalendar trades={trades} timezone={timezone} />;
}
