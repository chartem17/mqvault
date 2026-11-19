"use client";
import { Segmented } from "@/components/ui/segmented";
import { Button, Select } from "@/components/ui/primitives";
import { MetricCard } from "@/components/ui/metric-card";
import { msg } from "@/lib/i18n/core";
import { surfaceClass } from "@/components/ui/surface-styles";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock3, RefreshCw } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useTimezone } from "@/components/providers/timezone-provider";
import { useTrades } from "@/hooks/use-trades";
import { MyTradesNews } from "@/components/calendar/my-trades-news";
import { zonedWeekRange } from "@/lib/time/timezone";
import type { CalendarEvent } from "@/lib/news/economic-calendar";
type Impact = "high" | "medium" | "low";
type ViewMode = "calendar" | "trades";
type EventItem = { id: string; ts: number; currency: string; impact: Impact; title: string; forecast: string; previous: string; actual: string };
const DAY_MS = 86_400_000;
const impactStyles: Record<Impact, string> = { high: "border-red/30 bg-red/10 text-red", medium: "border-gold/30 bg-gold/10 text-gold", low: "border-border bg-secondary/30 text-muted-foreground" };
type Formatters = { time: Intl.DateTimeFormat; day: Intl.DateTimeFormat; key: Intl.DateTimeFormat };
/** Event times are shown and grouped by day in the user's zone and UI language. */
function formatters(timezone: string, intl: string): Formatters {
  return { time: new Intl.DateTimeFormat(intl, { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }), day: new Intl.DateTimeFormat(intl, { timeZone: timezone, weekday: "long", day: "numeric", month: "long" }), key: new Intl.DateTimeFormat("en-CA", { timeZone: timezone }) };
}
const IMPACT_LABEL: Record<Impact, string> = { high: msg("High"), medium: msg("Medium"), low: msg("Low") };
function mapImpact(value: string): Impact { const v = value.toLowerCase(); return v === "high" ? "high" : v === "medium" ? "medium" : "low"; }
/** Monday-to-Monday week in the user's zone, `offset` weeks from the current one (anchored mid-week, so DST shifts do not move it). */
function weekRange(offset: number, timezone: string) {
  const current = zonedWeekRange(Date.now(), timezone);
  return offset === 0 ? current : zonedWeekRange(current.from + offset * 7 * DAY_MS + 3.5 * DAY_MS, timezone);
}
export function CalendarTab() {
  const { visibleTrades } = useTrades();
  const [weekOffset, setWeekOffset] = useState(0);
  const [raw, setRaw] = useState<CalendarEvent[] | null>(null);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [mode, setMode] = useState<ViewMode>("calendar");
  const [impact, setImpact] = useState<"all" | Impact>("all");
  const [currency, setCurrency] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { t, tn, intl } = useI18n();
  const { timezone } = useTimezone();
  const f = useMemo(() => formatters(timezone, intl), [timezone, intl]);
  const dayKeyFmt = f.key, dayFmt = f.day, timeFmt = f.time;
  useEffect(() => {
    if (mode !== "calendar") return;
    let cancelled = false;
    setError(false);
    setRaw(null);
    const week = weekRange(weekOffset, timezone);
    const query = new URLSearchParams({ from: new Date(week.from).toISOString(), to: new Date(week.to).toISOString() });
    fetch(`/api/economic-calendar?${query}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((data: { events?: CalendarEvent[] }) => {
        if (cancelled) return;
        if (Array.isArray(data?.events)) { setRaw(data.events); } else { setError(true); }
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [reloadKey, timezone, weekOffset, mode]);
  const events = useMemo<EventItem[]>(() => {
    if (!raw) return [];
    return raw.map(e => ({ id: e.id, ts: new Date(e.time).getTime(), currency: e.currency ?? "", impact: mapImpact(e.impact), title: e.title, forecast: e.forecast || "—", previous: e.previous || "—", actual: e.actual || "—" }))
      .filter(e => !Number.isNaN(e.ts)).sort((a, b) => a.ts - b.ts);
  }, [raw]);
  const currencies = useMemo(() => [...new Set(events.map(e => e.currency))].sort(), [events]);
  const filtered = useMemo(() => events.filter(e => (impact === "all" || e.impact === impact) && (currency === "all" || e.currency === currency)), [events, impact, currency]);
  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; items: EventItem[] }>();
    filtered.forEach(e => { const d = new Date(e.ts); const key = dayKeyFmt.format(d); if (!map.has(key)) map.set(key, { label: dayFmt.format(d), items: [] }); map.get(key)!.items.push(e); });
    return [...map.values()];
  }, [filtered, dayKeyFmt, dayFmt]);
  const now = Date.now();
  const todayKey = dayKeyFmt.format(new Date());
  const todayCount = events.filter(e => dayKeyFmt.format(new Date(e.ts)) === todayKey).length;
  const highCount = events.filter(e => e.impact === "high").length;
  const nextHigh = events.find(e => e.impact === "high" && e.ts >= now);
  const jumpedRef = useRef(false);
  /** "My trades" opens on the week of the latest trade when the current week has none; "Calendar" returns to the current week. */
  function selectMode(value: ViewMode) {
    setMode(value);
    if (value === "calendar") { if (jumpedRef.current) { jumpedRef.current = false; setWeekOffset(0); } return; }
    if (weekOffset !== 0) return;
    const times = visibleTrades.map(trade => Date.parse(trade.closed_at ?? trade.opened_at)).filter(Number.isFinite);
    if (!times.length) return;
    const latest = Math.max(...times);
    const currentFrom = weekRange(0, timezone).from;
    if (latest >= currentFrom) return;
    jumpedRef.current = true;
    setWeekOffset(Math.round((zonedWeekRange(latest, timezone).from - currentFrom) / (7 * DAY_MS)));
  }
  const isCurrentWeek = weekOffset === 0;
  const week = useMemo(() => weekRange(weekOffset, timezone), [weekOffset, timezone]);
  const rangeFmt = useMemo(() => new Intl.DateTimeFormat(intl, { timeZone: timezone, day: "numeric", month: "short" }), [intl, timezone]);
  const weekLabel = `${rangeFmt.format(new Date(week.from))} – ${rangeFmt.format(new Date(week.to - 1))}`;
  const loading = raw === null && !error;
  const nav = <div className="flex flex-wrap items-center gap-1.5"><Button variant="secondary" size="icon" type="button" aria-label={t("Previous week")} onClick={() => setWeekOffset(o => o - 1)}><ChevronLeft className="h-3.5 w-3.5" /></Button><span className="min-w-[7.5rem] text-center text-xs text-muted-foreground">{weekLabel}</span><Button variant="secondary" size="icon" type="button" aria-label={t("Next week")} onClick={() => setWeekOffset(o => o + 1)}><ChevronRight className="h-3.5 w-3.5" /></Button>{!isCurrentWeek && <Button variant="secondary" type="button" onClick={() => setWeekOffset(0)}><CalendarDays className="mr-1.5 h-3.5 w-3.5" />{t("This week")}</Button>}</div>;
  return <div className="min-h-full space-y-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-xl font-bold">{t("Economic calendar")}</h1><p className="mt-1 text-xs text-muted-foreground">{t("Macro events · news exposure · Trade Vault analytics")}</p></div><div className="flex items-center gap-2"><div className={surfaceClass("flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground")}><Clock3 className="h-3.5 w-3.5" /> {timezone} <span className="text-primary">· {t("MetaTrader 5 calendar")}</span></div>{mode === "calendar" && <Button variant="secondary" size="icon" type="button" aria-label={t("Reload calendar")} onClick={() => setReloadKey(k => k + 1)} ><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /></Button>}</div></div>
    <div className={surfaceClass("flex flex-wrap items-center gap-2 p-3")}><Segmented aria-label={t("Calendar view")} value={mode} onChange={selectMode} options={[{ value: "calendar" as ViewMode, label: t("Calendar") }, { value: "trades" as ViewMode, label: t("My trades") }]} />{mode === "calendar" && <><div className="h-5 w-px bg-border" />{(["all", "high", "medium", "low"] as const).map(value => <button key={value} type="button" onClick={() => setImpact(value)} className={`rounded-lg border px-3 py-1.5 text-xs ${impact === value ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-secondary/50 text-muted-foreground"}`}>{value === "all" ? t("All impact") : t(IMPACT_LABEL[value])}</button>)}<Select value={currency} onChange={e => setCurrency(e.target.value)} aria-label={t("Filter calendar currency")} className="w-auto"><option value="all">{t("All currencies")}</option>{currencies.map(c => <option key={c} value={c}>{c}</option>)}</Select></>}</div>
    {mode === "trades" ? <MyTradesNews week={week} nav={nav} /> : <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><Summary label={t("Today")} value={!isCurrentWeek ? "—" : loading ? "…" : tn(todayCount, "{count} event", "{count} events")} hint={!isCurrentWeek ? t("Current week only") : t("{count} high impact", { count: events.filter(e => e.impact === "high" && dayKeyFmt.format(new Date(e.ts)) === todayKey).length })} /><Summary label={t("Next high impact")} value={nextHigh ? `${nextHigh.currency} · ${nextHigh.title}` : "—"} hint={nextHigh ? `${dayFmt.format(new Date(nextHigh.ts))} · ${timeFmt.format(new Date(nextHigh.ts))}` : weekOffset < 0 ? t("Past week") : t("None left this week")} /><Summary label={t("News risk this week")} value={t("{count} high impact", { count: highCount })} hint={t("From the weekly feed")} /></div>
      <section className={surfaceClass("overflow-hidden")}><div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-border px-4 py-3"><div><h2 className="text-sm font-semibold">{isCurrentWeek ? t("This week") : t("Week")}</h2><p className="mt-0.5 text-xs text-muted-foreground">{tn(filtered.length, "{count} event in current view", "{count} events in current view")}</p></div>{nav}</div>
        {loading && <div className="divide-y divide-border/70" aria-busy="true">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="flex items-center gap-3 px-4 py-4"><div className="h-3 w-12 animate-pulse rounded bg-secondary/60" /><div className="h-3 w-8 animate-pulse rounded bg-secondary/60" /><div className="h-3 flex-1 animate-pulse rounded bg-secondary/60" /></div>)}</div>}
        {error && <div className="px-4 py-10 text-center text-sm text-muted-foreground">{t("Could not load the calendar feed. It refreshes hourly upstream, so try again in a few minutes.")}<div className="mt-3"><Button variant="secondary" size="sm" type="button" onClick={() => setReloadKey(k => k + 1)} >{t("Retry")}</Button></div></div>}
        {!loading && !error && filtered.length === 0 && <div className="px-4 py-10 text-center text-sm text-muted-foreground">{t("No events match these filters.")}</div>}
        {!loading && !error && grouped.map(group => <div key={group.label}><div className="border-b border-border/70 bg-secondary/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</div><div className="divide-y divide-border/70">{group.items.map(event => <EventRow key={event.id} event={event} timeFmt={timeFmt} expanded={selectedId === event.id} onToggle={() => setSelectedId(selectedId === event.id ? null : event.id)} />)}</div></div>)}
      </section>
    </>}
  </div>;
}
function EventRow({ event, expanded, onToggle, timeFmt }: { event: EventItem; expanded: boolean; onToggle: () => void; timeFmt: Intl.DateTimeFormat }) {
  const { t } = useI18n();
  const past = event.ts < Date.now();
  return <div className={`transition ${expanded ? "bg-secondary/20" : ""} ${past ? "opacity-70" : ""}`}><button type="button" onClick={onToggle} aria-expanded={expanded} className="grid w-full grid-cols-[64px_48px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left hover:bg-secondary/35"><div className="font-mono text-xs text-muted-foreground">{timeFmt.format(new Date(event.ts))}</div><div className="text-xs font-semibold">{event.currency}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="truncate text-sm font-medium">{event.title}</span><span className={`rounded-md border px-1.5 py-0.5 text-[10px] uppercase ${impactStyles[event.impact]}`}>{t(IMPACT_LABEL[event.impact])}</span></div><div className="mt-1 text-xs text-muted-foreground">{t("Forecast {forecast} · Previous {previous}", { forecast: event.forecast, previous: event.previous })}</div></div><ChevronDown className={`h-4 w-4 text-muted-foreground transition ${expanded ? "rotate-180 text-primary" : ""}`} /></button>{expanded && <EventDetails event={event} past={past} />}</div>;
}
function EventDetails({ event, past }: { event: EventItem; past: boolean }) {
  const { t } = useI18n();
  return <div className="border-t border-primary/15 bg-secondary/30 px-4 pb-5 pt-4 sm:px-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label={t("Actual")} value={event.actual} /><Metric label={t("Forecast")} value={event.forecast} /><Metric label={t("Previous")} value={event.previous} /><Metric label={t("Status")} value={past ? t("Released") : t("Upcoming")} /></div></div>;
}
function Metric({ label, value }: { label: string; value: string }) {
  return <MetricCard variant="detail" label={label} value={value} />;
}
function Summary({ label, value, hint }: { label: string; value: string; hint: string }) {
  return <MetricCard variant="compact" label={label} value={value} hint={hint} valueClassName="truncate" />;
}
