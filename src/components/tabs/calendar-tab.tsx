"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, Clock3, TrendingDown, TrendingUp } from "lucide-react";

type Impact = "high" | "medium" | "low";
type ViewMode = "calendar" | "exposure";

type ApiEvent = {
  id: string;
  title: string;
  country: string | null;
  currency: string | null;
  impact: string | null;
  event_time: string;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  unit: string | null;
  linked_trades: number;
};

type EventItem = {
  id: string;
  ts: number;
  day: string;
  time: string;
  currency: string;
  country: string;
  impact: Impact;
  title: string;
  forecast: string;
  previous: string;
  actual: string;
  released: boolean;
  linked: number;
};

const TZ = "Europe/Kyiv";

const ASSETS: Record<string, string[]> = {
  USD: ["EUR/USD", "GBP/USD", "XAU/USD", "US30", "BTC/USDT"],
  EUR: ["EUR/USD", "GER40"],
  GBP: ["GBP/USD", "UK100"],
  JPY: ["USD/JPY", "JP225"],
  AUD: ["AUD/USD"],
  NZD: ["NZD/USD"],
  CAD: ["USD/CAD"],
  CHF: ["USD/CHF"],
};

const impactStyles: Record<Impact, string> = {
  high: "border-red-400/30 bg-red-500/10 text-red-300",
  medium: "border-amber-300/30 bg-amber-400/10 text-amber-200",
  low: "border-white/10 bg-white/[0.04] text-muted-foreground",
};

function normImpact(value: string | null): Impact {
  const v = (value ?? "").toLowerCase();
  return v === "high" ? "high" : v === "medium" ? "medium" : "low";
}

function fmtValue(value: string | null, unit: string | null) {
  if (!value) return "—";
  return unit && !value.endsWith(unit) ? `${value}${unit}` : value;
}

function toItem(e: ApiEvent): EventItem {
  const d = new Date(e.event_time);
  return {
    id: e.id,
    ts: d.getTime(),
    day: new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(d),
    time: new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d),
    currency: e.currency ?? "—",
    country: e.country ?? "",
    impact: normImpact(e.impact),
    title: e.title,
    forecast: fmtValue(e.forecast, e.unit),
    previous: fmtValue(e.previous, e.unit),
    actual: fmtValue(e.actual, e.unit),
    released: d.getTime() <= Date.now(),
    linked: e.linked_trades,
  };
}

function exposureLabel(n: number) {
  return n === 0 ? "No linked trades" : `${n} trade${n === 1 ? "" : "s"} nearby`;
}

export function CalendarTab() {
  const [mode, setMode] = useState<ViewMode>("calendar");
  const [impact, setImpact] = useState<"all" | Impact>("all");
  const [currency, setCurrency] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const from = new Date(Date.now() - 7 * 86400000).toISOString();
    const to = new Date(Date.now() + 14 * 86400000).toISOString();
    fetch(`/api/news?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { signal: ctrl.signal })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load events");
        setEvents(((json.data ?? []) as ApiEvent[]).map(toItem));
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  const currencies = useMemo(
    () => Array.from(new Set(events.map((e) => e.currency).filter((c) => c !== "—"))).sort(),
    [events],
  );

  const filtered = useMemo(
    () =>
      events.filter(
        (e) =>
          (impact === "all" || e.impact === impact) &&
          (currency === "all" || e.currency === currency) &&
          (mode === "calendar" || e.linked > 0),
      ),
    [events, impact, currency, mode],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    for (const e of filtered) map.set(e.day, [...(map.get(e.day) ?? []), e]);
    return Array.from(map.entries());
  }, [filtered]);

  const todayKey = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const todayCount = events.filter((e) => e.day === todayKey).length;
  const highUpcoming = events.filter((e) => e.impact === "high" && !e.released);
  const nextHigh = highUpcoming[0];
  const exposed = events.filter((e) => e.linked > 0).length;
  const lastSync = events.length ? "Live data" : "No data";

  return (
    <div className="min-h-full p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Economic Calendar</h1>
          <p className="mt-1 text-xs text-muted-foreground">Macro events · news exposure · Trade Vault analytics</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card/70 px-3 py-2 text-xs text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5" /> Europe/Kyiv <span className="text-primary">· {lastSync}</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Summary label="Today" value={`${todayCount} events`} hint={`${events.filter((e) => e.day === todayKey && e.impact === "high").length} high impact`} />
        <Summary label="Next high impact" value={nextHigh ? `${nextHigh.currency} · ${nextHigh.title}` : "—"} hint={nextHigh ? `${nextHigh.day} · ${nextHigh.time}` : "No upcoming high impact"} />
        <Summary label="Your exposure" value={`${exposed} events`} hint="With linked trades" />
        <Summary label="News risk ahead" value={`${highUpcoming.length} high impact`} hint="Upcoming in range" />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/70 p-3">
        <div className="flex rounded-lg border border-border bg-secondary/50 p-1">
          {(["calendar", "exposure"] as ViewMode[]).map((value) => (
            <button key={value} onClick={() => setMode(value)} className={`rounded-md px-3 py-1.5 text-xs ${mode === value ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}>
              {value === "calendar" ? "Calendar" : "My trades"}
            </button>
          ))}
        </div>
        <div className="h-5 w-px bg-border" />
        {(["all", "high", "medium", "low"] as const).map((value) => (
          <button key={value} onClick={() => setImpact(value)} className={`rounded-lg border px-3 py-1.5 text-xs ${impact === value ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-secondary/50 text-muted-foreground"}`}>
            {value === "all" ? "All impact" : `${value[0].toUpperCase()}${value.slice(1)}`}
          </button>
        ))}
        <select value={currency} onChange={(event) => setCurrency(event.target.value)} className="rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-xs text-foreground outline-none">
          <option value="all">All currencies</option>
          {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-card/75">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">{mode === "calendar" ? "Events" : "News-exposed trades"}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{filtered.length} events in current view</p>
          </div>
          <CalendarDays className="h-4 w-4 text-primary" />
        </div>

        {loading && (
          <div className="space-y-px">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 animate-pulse bg-secondary/30" />)}
          </div>
        )}
        {!loading && error && <div className="p-8 text-center text-sm text-red-300">{error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="p-10 text-center text-sm text-muted-foreground">
            {mode === "exposure" ? "No events are linked to your trades yet." : "No events match these filters."}
          </div>
        )}
        {!loading && !error && grouped.map(([day, items]) => (
          <div key={day}>
            <div className="border-y border-border/70 bg-secondary/25 px-4 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">{day}</div>
            <div className="divide-y divide-border/70">
              {items.map((event) => (
                <EventRow key={event.id} event={event} expanded={selectedId === event.id} onToggle={() => setSelectedId(selectedId === event.id ? null : event.id)} mode={mode} />
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function EventRow({ event, expanded, onToggle, mode }: { event: EventItem; expanded: boolean; onToggle: () => void; mode: ViewMode }) {
  return (
    <div className={`transition ${expanded ? "bg-secondary/20" : ""}`}>
      <button type="button" onClick={onToggle} className="grid w-full grid-cols-[64px_48px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left hover:bg-secondary/35">
        <div className="font-mono text-xs text-muted-foreground">{event.time}</div>
        <div className="text-xs font-semibold">{event.currency}</div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium">{event.title}</span>
            <span className={`rounded-md border px-1.5 py-0.5 text-[10px] uppercase ${impactStyles[event.impact]}`}>{event.impact}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Forecast {event.forecast} · Previous {event.previous}{event.released ? ` · Actual ${event.actual}` : ""}
          </div>
          {(mode === "exposure" || event.linked > 0) && <div className="mt-1 text-[11px] text-primary">{exposureLabel(event.linked)}</div>}
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${expanded ? "rotate-180 text-primary" : ""}`} />
      </button>
      {expanded && <EventDetails event={event} />}
    </div>
  );
}

function EventDetails({ event }: { event: EventItem }) {
  const assets = ASSETS[event.currency] ?? [];
  return (
    <div className="border-t border-primary/15 bg-[#0c1211]/55 px-4 pb-5 pt-4 sm:px-6">
      <div className="grid gap-4 xl:grid-cols-4">
        <Metric label="Actual" value={event.released ? event.actual : "—"} />
        <Metric label="Forecast" value={event.forecast} />
        <Metric label="Previous" value={event.previous} />
        <Metric label="Status" value={event.released ? "Released" : "Upcoming"} />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Scenario title="Higher than forecast" icon={<TrendingUp className="h-4 w-4" />} tone="positive" currency={event.currency} assets={assets} />
        <Scenario title="Lower than forecast" icon={<TrendingDown className="h-4 w-4" />} tone="negative" currency={event.currency} assets={assets} />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Source</div>
          <p className="mt-2 text-sm text-muted-foreground">{event.country || event.currency} · FairEconomy / Forex Factory feed</p>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Trade Vault context</div>
          <div className="mt-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-primary">{exposureLabel(event.linked)}</div>
        </div>
      </div>
      <div className="mt-5 rounded-xl border border-border bg-secondary/20 p-3 text-xs text-muted-foreground">
        Note: scenario text is a generic currency-level read, not a forecast. Price action can differ when expectations are already priced in.
      </div>
    </div>
  );
}

function Scenario({ title, icon, tone, currency, assets }: { title: string; icon: React.ReactNode; tone: "positive" | "negative"; currency: string; assets: string[] }) {
  const up = tone === "positive";
  return (
    <div className={`rounded-2xl border p-4 ${up ? "border-emerald-400/20 bg-emerald-400/[.05]" : "border-rose-400/20 bg-rose-400/[.05]"}`}>
      <div className="flex items-center gap-2 text-sm font-semibold">{icon}{title}</div>
      <div className="mt-3 text-sm font-medium">{currency} {up ? "supportive" : "negative"}</div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {up ? `A reading above forecast can support ${currency} through firmer rate expectations.` : `A reading below forecast can weigh on ${currency} through softer rate expectations.`}
      </p>
      {assets.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {assets.map((symbol) => <span key={symbol} className="rounded-md border border-border bg-black/15 px-2 py-1 text-xs">{symbol}</span>)}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-3">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-sm">{value}</div>
    </div>
  );
}

function Summary({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/75 p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 truncate text-lg font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}
