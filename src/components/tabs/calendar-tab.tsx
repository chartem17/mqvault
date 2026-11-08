"use client";
import { Button, Select } from "@/components/ui/primitives";
import { MetricCard } from "@/components/ui/metric-card";
import { msg } from "@/lib/i18n/core";
import { surfaceClass } from "@/components/ui/surface-styles";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock3, RefreshCw } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useTimezone } from "@/components/providers/timezone-provider";
import { useTrades } from "@/hooks/use-trades";
import { edgeOffsetLabel } from "@/components/journal/trade-news";
import { zonedWeekRange } from "@/lib/time/timezone";
import { NEWS_EDGE_MINUTES, nearestTradeEdge, newsCurrenciesForSymbol } from "@/lib/news/news-trades";
import type { CalendarEvent } from "@/lib/news/economic-calendar";
type Impact = "high" | "medium" | "low";
type ViewMode = "calendar" | "exposure";
type ExposedTrade = { id: string; symbol: string; edge: "entry" | "exit"; minutes: number };
type EventItem = { id: string; ts: number; currency: string; impact: Impact; title: string; forecast: string; previous: string; actual: string; trades: ExposedTrade[] };
const DAY_MS = 86_400_000;
const impactStyles: Record<Impact, string> = { high: "border-red/30 bg-red/10 text-red", medium: "border-gold/30 bg-gold/10 text-gold", low: "border-border bg-secondary/30 text-muted-foreground" };
type Formatters = { time: Intl.DateTimeFormat; day: Intl.DateTimeFormat; key: Intl.DateTimeFormat };
/** Event times are shown and grouped by day in the user's zone and UI language. */
function formatters(timezone: string, intl: string): Formatters {
  return { time: new Intl.DateTimeFormat(intl, { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }), day: new Intl.DateTimeFormat(intl, { timeZone: timezone, weekday: "long", day: "numeric", month: "long" }), key: new Intl.DateTimeFormat("en-CA", { timeZone: timezone }) };
}
const IMPACT_LABEL: Record<Impact, string> = { high: msg("High"), medium: msg("Medium"), low: msg("Low") };
function mapImpact(value: string): Impact { const v = value.toLowerCase(); return v === "high" ? "high" : v === "medium" ? "medium" : "low"; }
type TradeTimes = { id: string; symbol: string; open: number; close: number | null; currencies: string[] };
/** A trade is exposed to a release when its entry or exit falls within NEWS_EDGE_MINUTES of it (ADR 0014). */
function exposure(trade: TradeTimes, currency: string, ts: number): ExposedTrade | null {
  if (!trade.currencies.includes(currency)) return null;
  const near = nearestTradeEdge(Math.round((ts - trade.open) / 60_000), trade.close === null ? null : Math.round((ts - trade.close) / 60_000), NEWS_EDGE_MINUTES);
  return near ? { id: trade.id, symbol: trade.symbol, edge: near.edge, minutes: near.minutes } : null;
}
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
  }, [reloadKey, timezone, weekOffset]);
  const tradeTimes = useMemo<TradeTimes[]>(() => visibleTrades.flatMap(trade => {
    const open = Date.parse(trade.opened_at);
    if (!Number.isFinite(open)) return [];
    const closed = trade.closed_at ? Date.parse(trade.closed_at) : NaN;
    return [{ id: trade.id, symbol: trade.symbol, open, close: Number.isFinite(closed) && closed >= open ? closed : null, currencies: newsCurrenciesForSymbol(trade.symbol) }];
  }), [visibleTrades]);
  const events = useMemo<EventItem[]>(() => {
    if (!raw) return [];
    return raw.map(e => {
      const ts = new Date(e.time).getTime();
      const currency = e.currency ?? "";
      return { id: e.id, ts, currency, impact: mapImpact(e.impact), title: e.title, forecast: e.forecast || "—", previous: e.previous || "—", actual: e.actual || "—", trades: tradeTimes.map(trade => exposure(trade, currency, ts)).filter((x): x is ExposedTrade => x !== null) };
    }).filter(e => !Number.isNaN(e.ts)).sort((a, b) => a.ts - b.ts);
  }, [raw, tradeTimes]);
  const currencies = useMemo(() => [...new Set(events.map(e => e.currency))].sort(), [events]);
  const filtered = useMemo(() => events.filter(e => (impact === "all" || e.impact === impact) && (currency === "all" || e.currency === currency) && (mode === "calendar" || e.trades.length > 0)), [events, impact, currency, mode]);
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
  const exposedEvents = events.filter(e => e.trades.length > 0);
  const exposedHigh = exposedEvents.filter(e => e.impact === "high").length;
  const jumpedRef = useRef(false);
  /** "My trades" opens on the week of the latest trade when the current week has none; "Calendar" returns to the current week. */
  function selectMode(value: ViewMode) {
    setMode(value);
    if (value === "calendar") { if (jumpedRef.current) { jumpedRef.current = false; setWeekOffset(0); } return; }
    if (weekOffset !== 0 || !tradeTimes.length) return;
    const latest = Math.max(...tradeTimes.map(trade => trade.close ?? trade.open));
    const currentFrom = weekRange(0, timezone).from;
    if (latest >= currentFrom) return;
    jumpedRef.current = true;
    setWeekOffset(Math.round((zonedWeekRange(latest, timezone).from - currentFrom) / (7 * DAY_MS)));
  }
  const hasTrades = tradeTimes.length > 0;
  const isCurrentWeek = weekOffset === 0;
  const week = useMemo(() => weekRange(weekOffset, timezone), [weekOffset, timezone]);
  const rangeFmt = useMemo(() => new Intl.DateTimeFormat(intl, { timeZone: timezone, day: "numeric", month: "short" }), [intl, timezone]);
  const weekLabel = `${rangeFmt.format(new Date(week.from))} – ${rangeFmt.format(new Date(week.to - 1))}`;
  const loading = raw === null && !error;
  return <div className="min-h-full space-y-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-xl font-bold">{t("Economic calendar")}</h1><p className="mt-1 text-xs text-muted-foreground">{t("Macro events · news exposure · Trade Vault analytics")}</p></div><div className="flex items-center gap-2"><div className={surfaceClass("flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground")}><Clock3 className="h-3.5 w-3.5" /> {timezone} <span className="text-primary">· {t("MetaTrader 5 calendar")}</span></div><Button variant="secondary" size="icon" type="button" aria-label={t("Reload calendar")} onClick={() => setReloadKey(k => k + 1)} ><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /></Button></div></div>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4"><Summary label={t("Today")} value={!isCurrentWeek ? "—" : loading ? "…" : tn(todayCount, "{count} event", "{count} events")} hint={!isCurrentWeek ? t("Current week only") : t("{count} high impact", { count: events.filter(e => e.impact === "high" && dayKeyFmt.format(new Date(e.ts)) === todayKey).length })} /><Summary label={t("Next high impact")} value={nextHigh ? `${nextHigh.currency} · ${nextHigh.title}` : "—"} hint={nextHigh ? `${dayFmt.format(new Date(nextHigh.ts))} · ${timeFmt.format(new Date(nextHigh.ts))}` : weekOffset < 0 ? t("Past week") : t("None left this week")} /><Summary label={t("Your exposure")} value={hasTrades ? tn(exposedEvents.length, "{count} event", "{count} events") : "—"} hint={hasTrades ? t("Entry or exit within 1 h of a release") : t("No trades in the journal yet")} /><Summary label={t("News risk this week")} value={t("{count} high impact", { count: highCount })} hint={hasTrades ? t("{count} with your trades", { count: exposedHigh }) : t("From the weekly feed")} /></div>
    <div className={surfaceClass("flex flex-wrap items-center gap-2 p-3")}><div className="flex rounded-lg border border-border bg-secondary/50 p-1">{(["calendar", "exposure"] as ViewMode[]).map(value => <button key={value} onClick={() => selectMode(value)} className={`rounded-md px-3 py-1.5 text-xs ${mode === value ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}>{value === "calendar" ? t("Calendar") : t("My trades")}</button>)}</div><div className="h-5 w-px bg-border" />{(["all", "high", "medium", "low"] as const).map(value => <button key={value} onClick={() => setImpact(value)} className={`rounded-lg border px-3 py-1.5 text-xs ${impact === value ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-secondary/50 text-muted-foreground"}`}>{value === "all" ? t("All impact") : t(IMPACT_LABEL[value])}</button>)}<Select value={currency} onChange={e => setCurrency(e.target.value)} aria-label={t("Filter calendar currency")} className="w-auto"><option value="all">{t("All currencies")}</option>{currencies.map(c => <option key={c} value={c}>{c}</option>)}</Select></div>
    <section className={surfaceClass("overflow-hidden")}><div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-border px-4 py-3"><div><h2 className="text-sm font-semibold">{mode === "calendar" ? (isCurrentWeek ? t("This week") : t("Week")) : t("News-exposed trades")}</h2><p className="mt-0.5 text-xs text-muted-foreground">{tn(filtered.length, "{count} event in current view", "{count} events in current view")}</p></div><div className="flex flex-wrap items-center gap-1.5"><Button variant="secondary" size="icon" type="button" aria-label={t("Previous week")} onClick={() => setWeekOffset(o => o - 1)}><ChevronLeft className="h-3.5 w-3.5" /></Button><span className="min-w-[7.5rem] text-center text-xs text-muted-foreground">{weekLabel}</span><Button variant="secondary" size="icon" type="button" aria-label={t("Next week")} onClick={() => setWeekOffset(o => o + 1)}><ChevronRight className="h-3.5 w-3.5" /></Button>{!isCurrentWeek && <Button variant="secondary" type="button" onClick={() => setWeekOffset(0)}><CalendarDays className="mr-1.5 h-3.5 w-3.5" />{t("This week")}</Button>}</div></div>
      {loading && <div className="divide-y divide-border/70" aria-busy="true">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="flex items-center gap-3 px-4 py-4"><div className="h-3 w-12 animate-pulse rounded bg-secondary/60" /><div className="h-3 w-8 animate-pulse rounded bg-secondary/60" /><div className="h-3 flex-1 animate-pulse rounded bg-secondary/60" /></div>)}</div>}
      {error && <div className="px-4 py-10 text-center text-sm text-muted-foreground">{t("Could not load the calendar feed. It refreshes hourly upstream, so try again in a few minutes.")}<div className="mt-3"><Button variant="secondary" size="sm" type="button" onClick={() => setReloadKey(k => k + 1)} >{t("Retry")}</Button></div></div>}
      {!loading && !error && filtered.length === 0 && <div className="px-4 py-10 text-center text-sm text-muted-foreground">{mode === "exposure" && !hasTrades ? t("No trades in the journal yet, so there is no news exposure to show.") : mode === "exposure" ? t("No trade entered or exited within 1 hour of these events. Try another week or impact filter.") : t("No events match these filters.")}</div>}
      {!loading && !error && grouped.map(group => <div key={group.label}><div className="border-b border-border/70 bg-secondary/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</div><div className="divide-y divide-border/70">{group.items.map(event => <EventRow key={event.id} event={event} mode={mode} timeFmt={timeFmt} expanded={selectedId === event.id} onToggle={() => setSelectedId(selectedId === event.id ? null : event.id)} />)}</div></div>)}
    </section>
  </div>;
}
function EventRow({ event, expanded, onToggle, mode, timeFmt }: { event: EventItem; expanded: boolean; onToggle: () => void; mode: ViewMode; timeFmt: Intl.DateTimeFormat }) {
  const { t, tn } = useI18n();
  const past = event.ts < Date.now();
  return <div className={`transition ${expanded ? "bg-secondary/20" : ""} ${past ? "opacity-70" : ""}`}><button type="button" onClick={onToggle} aria-expanded={expanded} className="grid w-full grid-cols-[64px_48px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left hover:bg-secondary/35"><div className="font-mono text-xs text-muted-foreground">{timeFmt.format(new Date(event.ts))}</div><div className="text-xs font-semibold">{event.currency}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="truncate text-sm font-medium">{event.title}</span><span className={`rounded-md border px-1.5 py-0.5 text-[10px] uppercase ${impactStyles[event.impact]}`}>{t(IMPACT_LABEL[event.impact])}</span></div><div className="mt-1 text-xs text-muted-foreground">{t("Forecast {forecast} · Previous {previous}", { forecast: event.forecast, previous: event.previous })}</div>{mode === "exposure" && event.trades.length > 0 && <div className="mt-1 text-[11px] text-primary">{tn(event.trades.length, "{count} trade", "{count} trades")} · {[...new Set(event.trades.map(t => t.symbol))].join(", ")}</div>}</div><ChevronDown className={`h-4 w-4 text-muted-foreground transition ${expanded ? "rotate-180 text-primary" : ""}`} /></button>{expanded && <EventDetails event={event} past={past} />}</div>;
}
function EventDetails({ event, past }: { event: EventItem; past: boolean }) {
  const { t } = useI18n();
  return <div className="border-t border-primary/15 bg-secondary/30 px-4 pb-5 pt-4 sm:px-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label={t("Actual")} value={event.actual} /><Metric label={t("Forecast")} value={event.forecast} /><Metric label={t("Previous")} value={event.previous} /><Metric label={t("Status")} value={past ? t("Released") : t("Upcoming")} /></div><div className="mt-5"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("Trade Vault context")}</div><div className="mt-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-primary">{event.trades.length === 0 ? t("No trade entered or exited within 1 hour of this event.") : <ul className="m-0 list-none space-y-1 p-0">{event.trades.map(trade => <li key={trade.id}><span className="font-medium">{trade.symbol}</span> · {edgeOffsetLabel(trade.edge, trade.minutes, t)}</li>)}</ul>}</div></div></div>;
}
function Metric({ label, value }: { label: string; value: string }) {
          return <MetricCard variant="detail" label={label} value={value} />;
        }
        function Summary({ label, value, hint }: { label: string; value: string; hint: string }) {
          return <MetricCard variant="compact" label={label} value={value} hint={hint} valueClassName="truncate" />;
        }
