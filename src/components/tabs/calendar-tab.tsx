"use client";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, Clock3, RefreshCw } from "lucide-react";
type Impact = "high" | "medium" | "low";
type ViewMode = "calendar" | "exposure";
export type CalendarTrade = { id?: string | number; symbol: string; openedAt: string | Date; closedAt?: string | Date | null };
type RawEvent = { title: string; country: string; date: string; impact: string; forecast?: string; previous?: string; actual?: string };
type EventItem = { id: string; ts: number; currency: string; impact: Impact; title: string; forecast: string; previous: string; actual: string; trades: CalendarTrade[] };
const TZ = "Europe/Kyiv";
const EXPOSURE_WINDOW_MS = 60 * 60 * 1000;
const INDEX_CURRENCY: Record<string, string> = { US30: "USD", US500: "USD", SPX500: "USD", NAS100: "USD", USTEC: "USD", GER40: "EUR", DE40: "EUR", UK100: "GBP", JP225: "JPY", AUS200: "AUD" };
const METAL_CRYPTO = ["XAU", "XAG", "BTC", "ETH"];
const impactStyles: Record<Impact, string> = { high: "border-red-400/30 bg-red-500/10 text-red-300", medium: "border-amber-300/30 bg-amber-400/10 text-amber-200", low: "border-white/10 bg-white/[0.04] text-muted-foreground" };
const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
const dayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });
function mapImpact(value: string): Impact { const v = value.toLowerCase(); return v === "high" ? "high" : v === "medium" ? "medium" : "low"; }
function symbolCurrencies(symbol: string): string[] {
  const s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (INDEX_CURRENCY[s]) return [INDEX_CURRENCY[s]];
  const out = new Set<string>();
  if (s.length >= 6) { out.add(s.slice(0, 3)); out.add(s.slice(3, 6)); }
  if (s.endsWith("USDT")) out.add("USD");
  METAL_CRYPTO.forEach(c => out.delete(c));
  return [...out];
}
function tradeTouchesEvent(trade: CalendarTrade, currency: string, ts: number) {
  if (!symbolCurrencies(trade.symbol).includes(currency)) return false;
  const open = new Date(trade.openedAt).getTime();
  const close = trade.closedAt ? new Date(trade.closedAt).getTime() : Date.now();
  if (Number.isNaN(open) || Number.isNaN(close)) return false;
  return open - EXPOSURE_WINDOW_MS <= ts && close + EXPOSURE_WINDOW_MS >= ts;
}
export function CalendarTab({ trades }: { trades?: CalendarTrade[] }) {
  const [raw, setRaw] = useState<RawEvent[] | null>(null);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [mode, setMode] = useState<ViewMode>("calendar");
  const [impact, setImpact] = useState<"all" | Impact>("all");
  const [currency, setCurrency] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setError(false);
    setRaw(null);
    fetch("/api/economic-calendar")
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(data => {
        if (cancelled) return;
        if (Array.isArray(data)) { setRaw(data); } else { setError(true); }
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [reloadKey]);
  const events = useMemo<EventItem[]>(() => {
    if (!raw) return [];
    return raw.map((e, i) => {
      const ts = new Date(e.date).getTime();
      return { id: `${e.date}-${e.country}-${i}`, ts, currency: e.country, impact: mapImpact(e.impact), title: e.title, forecast: e.forecast || "—", previous: e.previous || "—", actual: e.actual || "—", trades: (trades ?? []).filter(t => tradeTouchesEvent(t, e.country, ts)) };
    }).filter(e => !Number.isNaN(e.ts)).sort((a, b) => a.ts - b.ts);
  }, [raw, trades]);
  const currencies = useMemo(() => [...new Set(events.map(e => e.currency))].sort(), [events]);
  const filtered = useMemo(() => events.filter(e => (impact === "all" || e.impact === impact) && (currency === "all" || e.currency === currency) && (mode === "calendar" || e.trades.length > 0)), [events, impact, currency, mode]);
  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; items: EventItem[] }>();
    filtered.forEach(e => { const d = new Date(e.ts); const key = dayKeyFmt.format(d); if (!map.has(key)) map.set(key, { label: dayFmt.format(d), items: [] }); map.get(key)!.items.push(e); });
    return [...map.values()];
  }, [filtered]);
  const now = Date.now();
  const todayKey = dayKeyFmt.format(new Date());
  const todayCount = events.filter(e => dayKeyFmt.format(new Date(e.ts)) === todayKey).length;
  const highCount = events.filter(e => e.impact === "high").length;
  const nextHigh = events.find(e => e.impact === "high" && e.ts >= now);
  const exposedEvents = events.filter(e => e.trades.length > 0);
  const exposedHigh = exposedEvents.filter(e => e.impact === "high").length;
  const hasTrades = !!trades && trades.length > 0;
  const loading = raw === null && !error;
  return <div className="min-h-full space-y-5 p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Economic Calendar</h1><p className="mt-1 text-xs text-muted-foreground">Macro events · news exposure · Trade Vault analytics</p></div><div className="flex items-center gap-2"><div className="flex items-center gap-2 rounded-xl border border-border bg-card/70 px-3 py-2 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> {TZ} <span className="text-primary">· Forex Factory feed</span></div><button type="button" aria-label="Reload calendar" onClick={() => setReloadKey(k => k + 1)} className="rounded-xl border border-border bg-card/70 p-2 text-muted-foreground hover:text-primary"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /></button></div></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Summary label="Today" value={loading ? "…" : `${todayCount} events`} hint={`${events.filter(e => e.impact === "high" && dayKeyFmt.format(new Date(e.ts)) === todayKey).length} high impact`} /><Summary label="Next high impact" value={nextHigh ? `${nextHigh.currency} · ${nextHigh.title}` : "—"} hint={nextHigh ? `${dayFmt.format(new Date(nextHigh.ts))} · ${timeFmt.format(new Date(nextHigh.ts))}` : "None left this week"} /><Summary label="Your exposure" value={hasTrades ? `${exposedEvents.length} events` : "—"} hint={hasTrades ? "Linked to your trades (±1h)" : "Connect trades to see exposure"} /><Summary label="News risk this week" value={`${highCount} high impact`} hint={hasTrades ? `${exposedHigh} with your trades` : "From the weekly feed"} /></div>
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/70 p-3"><div className="flex rounded-lg border border-border bg-secondary/50 p-1">{(["calendar", "exposure"] as ViewMode[]).map(value => <button key={value} onClick={() => setMode(value)} className={`rounded-md px-3 py-1.5 text-xs ${mode === value ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}>{value === "calendar" ? "Calendar" : "My trades"}</button>)}</div><div className="h-5 w-px bg-border" />{(["all", "high", "medium", "low"] as const).map(value => <button key={value} onClick={() => setImpact(value)} className={`rounded-lg border px-3 py-1.5 text-xs ${impact === value ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-secondary/50 text-muted-foreground"}`}>{value === "all" ? "All impact" : `${value[0].toUpperCase()}${value.slice(1)}`}</button>)}<select value={currency} onChange={e => setCurrency(e.target.value)} className="rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-xs text-foreground outline-none"><option value="all">All currencies</option>{currencies.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
    <section className="overflow-hidden rounded-2xl border border-border bg-card/75"><div className="flex items-center justify-between border-b border-border px-4 py-3"><div><h2 className="text-sm font-semibold">{mode === "calendar" ? "This week" : "News-exposed trades"}</h2><p className="mt-0.5 text-xs text-muted-foreground">{filtered.length} events in current view</p></div><CalendarDays className="h-4 w-4 text-primary" /></div>
      {loading && <div className="divide-y divide-border/70" aria-busy="true">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="flex items-center gap-3 px-4 py-4"><div className="h-3 w-12 animate-pulse rounded bg-secondary/60" /><div className="h-3 w-8 animate-pulse rounded bg-secondary/60" /><div className="h-3 flex-1 animate-pulse rounded bg-secondary/60" /></div>)}</div>}
      {error && <div className="px-4 py-10 text-center text-sm text-muted-foreground">Could not load the calendar feed. It refreshes hourly upstream, so try again in a few minutes.<div className="mt-3"><button type="button" onClick={() => setReloadKey(k => k + 1)} className="rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-xs text-foreground">Retry</button></div></div>}
      {!loading && !error && filtered.length === 0 && <div className="px-4 py-10 text-center text-sm text-muted-foreground">{mode === "exposure" && !hasTrades ? "No trades connected yet. Pass your trades to see which news events overlap them." : mode === "exposure" ? "None of your trades overlap with events in this view." : "No events match these filters."}</div>}
      {!loading && !error && grouped.map(group => <div key={group.label}><div className="border-b border-border/70 bg-secondary/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</div><div className="divide-y divide-border/70">{group.items.map(event => <EventRow key={event.id} event={event} mode={mode} expanded={selectedId === event.id} onToggle={() => setSelectedId(selectedId === event.id ? null : event.id)} />)}</div></div>)}
    </section>
  </div>;
}
function EventRow({ event, expanded, onToggle, mode }: { event: EventItem; expanded: boolean; onToggle: () => void; mode: ViewMode }) {
  const past = event.ts < Date.now();
  return <div className={`transition ${expanded ? "bg-secondary/20" : ""} ${past ? "opacity-70" : ""}`}><button type="button" onClick={onToggle} aria-expanded={expanded} className="grid w-full grid-cols-[64px_48px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left hover:bg-secondary/35"><div className="font-mono text-xs text-muted-foreground">{timeFmt.format(new Date(event.ts))}</div><div className="text-xs font-semibold">{event.currency}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="truncate text-sm font-medium">{event.title}</span><span className={`rounded-md border px-1.5 py-0.5 text-[10px] uppercase ${impactStyles[event.impact]}`}>{event.impact}</span></div><div className="mt-1 text-xs text-muted-foreground">Forecast {event.forecast} · Previous {event.previous}</div>{mode === "exposure" && event.trades.length > 0 && <div className="mt-1 text-[11px] text-primary">{event.trades.length} {event.trades.length === 1 ? "trade" : "trades"} · {[...new Set(event.trades.map(t => t.symbol))].join(", ")}</div>}</div><ChevronDown className={`h-4 w-4 text-muted-foreground transition ${expanded ? "rotate-180 text-primary" : ""}`} /></button>{expanded && <EventDetails event={event} past={past} />}</div>;
}
function EventDetails({ event, past }: { event: EventItem; past: boolean }) {
  const symbols = [...new Set(event.trades.map(t => t.symbol))];
  return <div className="border-t border-primary/15 bg-[#0c1211]/55 px-4 pb-5 pt-4 sm:px-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Actual" value={event.actual} /><Metric label="Forecast" value={event.forecast} /><Metric label="Previous" value={event.previous} /><Metric label="Status" value={past ? "Released" : "Upcoming"} /></div><div className="mt-5"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Trade Vault context</div><div className="mt-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-primary">{event.trades.length === 0 ? "No linked trades within ±1 hour of this event." : `${event.trades.length} ${event.trades.length === 1 ? "trade was" : "trades were"} open near this release: ${symbols.join(", ")}.`}</div></div></div>;
}
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-border bg-secondary/30 p-3"><div className="text-[10px] uppercase text-muted-foreground">{label}</div><div className="mt-1 font-mono text-sm">{value}</div></div>; }
function Summary({ label, value, hint }: { label: string; value: string; hint: string }) { return <div className="rounded-2xl border border-border bg-card/75 p-4"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div><div className="mt-2 truncate text-lg font-semibold">{value}</div><div className="mt-1 text-xs text-muted-foreground">{hint}</div></div>; }
