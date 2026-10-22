"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, Clock3, TrendingDown, TrendingUp } from "lucide-react";

type Impact = "high" | "medium" | "low" | "holiday";
type ViewMode = "calendar" | "exposure";

type NewsEvent = {
  id: string;
  title: string;
  country: string | null;
  currency: string | null;
  impact: Impact;
  event_time: string;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  unit: string | null;
  source: string;
  linked_trades: number;
};

const TZ = "Europe/Kyiv";

const impactStyles: Record<Impact, string> = {
  high: "border-red-400/30 bg-red-500/10 text-red-300",
  medium: "border-amber-300/30 bg-amber-400/10 text-amber-200",
  low: "border-white/10 bg-white/[0.04] text-muted-foreground",
  holiday: "border-sky-300/30 bg-sky-400/10 text-sky-200",
};

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });
const timeFmt = new Intl.DateTimeFormat("uk-UA", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
const dayFmt = new Intl.DateTimeFormat("uk-UA", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });

const dayKey = (iso: string) => dayKeyFmt.format(new Date(iso));
const timeLabel = (iso: string) => timeFmt.format(new Date(iso));
const dayLabel = (iso: string) => dayFmt.format(new Date(iso));

function value(v: string | null, unit: string | null) {
  if (!v) return "—";
  return unit && !v.endsWith(unit) ? `${v}${unit}` : v;
}

function statusOf(event: NewsEvent) {
  if (event.impact === "holiday") return "Holiday";
  if (event.actual) return "Released";
  return new Date(event.event_time).getTime() > Date.now() ? "Upcoming" : "Awaiting data";
}

export function CalendarTab() {
  const [mode, setMode] = useState<ViewMode>("calendar");
  const [impact, setImpact] = useState<"all" | Exclude<Impact, "holiday">>("all");
  const [currency, setCurrency] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [events, setEvents] = useState<NewsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/news", { cache: "no-store" });
        const json = await response.json();
        if (!response.ok) throw new Error(json?.error ?? "Failed to load news");
        if (!cancelled) setEvents(json.data ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load news");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const currencies = useMemo(
    () => Array.from(new Set(events.map((event) => event.currency).filter((c): c is string => !!c))).sort(),
    [events],
  );

  const filtered = useMemo(
    () =>
      events.filter(
        (event) =>
          (impact === "all" || event.impact === impact) &&
          (currency === "all" || event.currency === currency) &&
          (mode === "calendar" || event.linked_trades > 0),
      ),
    [events, impact, currency, mode],
  );

  const groups = useMemo(() => {
    const map = new Map<string, NewsEvent[]>();
    for (const event of filtered) {
      const key = dayKey(event.event_time);
      map.set(key, [...(map.get(key) ?? []), event]);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const summary = useMemo(() => {
    const now = Date.now();
    const today = dayKeyFmt.format(new Date());
    const nextHigh = events.find((event) => event.impact === "high" && new Date(event.event_time).getTime() > now);
    return {
      today: events.filter((event) => dayKey(event.event_time) === today).length,
      todayHigh: events.filter((event) => dayKey(event.event_time) === today && event.impact === "high").length,
      nextHigh,
      high: events.filter((event) => event.impact === "high").length,
      exposure: events.reduce((sum, event) => sum + event.linked_trades, 0),
    };
  }, [events]);

  return (
    <div className="min-h-full space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Economic Calendar</h1>
          <p className="mt-1 text-xs text-muted-foreground">Macro events · news exposure · Trade Vault analytics</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card/70 px-3 py-2 text-xs text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5" /> {TZ} <span className="text-primary">· Live data</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Summary label="Today" value={`${summary.today} events`} hint={`${summary.todayHigh} high impact`} />
        <Summary
          label="Next high impact"
          value={summary.nextHigh ? `${summary.nextHigh.currency ?? "—"} · ${summary.nextHigh.title}` : "None scheduled"}
          hint={summary.nextHigh ? `${dayLabel(summary.nextHigh.event_time)} · ${timeLabel(summary.nextHigh.event_time)}` : "No upcoming high-impact events"}
        />
        <Summary label="Your exposure" value={`${summary.exposure} trades`} hint="Linked to news events" />
        <Summary label="News risk in range" value={`${summary.high} high impact`} hint={`${events.length} events loaded`} />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/70 p-3">
        <div className="flex rounded-lg border border-border bg-secondary/50 p-1">
          {(["calendar", "exposure"] as ViewMode[]).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`rounded-md px-3 py-1.5 text-xs ${mode === m ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}>
              {m === "calendar" ? "Calendar" : "My trades"}
            </button>
          ))}
        </div>
        <div className="h-5 w-px bg-border" />
        {(["all", "high", "medium", "low"] as const).map((v) => (
          <button key={v} onClick={() => setImpact(v)} className={`rounded-lg border px-3 py-1.5 text-xs ${impact === v ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-secondary/50 text-muted-foreground"}`}>
            {v === "all" ? "All impact" : `${v[0].toUpperCase()}${v.slice(1)}`}
          </button>
        ))}
        <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-xs text-foreground outline-none">
          <option value="all">All currencies</option>
          {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-card/75">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">{mode === "calendar" ? "Upcoming events" : "News-exposed trades"}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{loading ? "Loading…" : `${filtered.length} events in current view`}</p>
          </div>
          <CalendarDays className="h-4 w-4 text-primary" />
        </div>

        {loading && (
          <div className="divide-y divide-border/70">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-4">
                <div className="h-4 w-12 animate-pulse rounded bg-secondary/60" />
                <div className="h-4 w-10 animate-pulse rounded bg-secondary/60" />
                <div className="h-4 flex-1 animate-pulse rounded bg-secondary/60" />
              </div>
            ))}
          </div>
        )}

        {!loading && error && <div className="px-4 py-10 text-center text-sm text-red-300">Не вдалося завантажити новини: {error}</div>}

        {!loading && !error && groups.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            {mode === "exposure" ? "Немає угод, пов'язаних з новинами." : "Немає подій за вибраними фільтрами."}
          </div>
        )}

        {!loading && !error && groups.map(([key, items]) => (
          <div key={key}>
            <div className="border-b border-border/70 bg-secondary/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{dayLabel(items[0].event_time)}</div>
            <div className="divide-y divide-border/70">
              {items.map((event) => (
                <EventRow key={event.id} event={event} mode={mode} expanded={selectedId === event.id} onToggle={() => setSelectedId(selectedId === event.id ? null : event.id)} />
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function exposureText(count: number) {
  return count > 0 ? `${count} linked trade${count === 1 ? "" : "s"}` : "No linked trades";
}

function EventRow({ event, expanded, onToggle, mode }: { event: NewsEvent; expanded: boolean; onToggle: () => void; mode: ViewMode }) {
  return (
    <div className={`transition ${expanded ? "bg-secondary/20" : ""}`}>
      <button type="button" onClick={onToggle} className="grid w-full grid-cols-[64px_48px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left hover:bg-secondary/35">
        <div className="font-mono text-xs text-muted-foreground">{timeLabel(event.event_time)}</div>
        <div className="text-xs font-semibold">{event.currency ?? "—"}</div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium">{event.title}</span>
            <span className={`rounded-md border px-1.5 py-0.5 text-[10px] uppercase ${impactStyles[event.impact] ?? impactStyles.low}`}>{event.impact}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {event.country ?? event.currency ?? "—"} · Actual {value(event.actual, event.unit)} · Forecast {value(event.forecast, event.unit)} · Previous {value(event.previous, event.unit)}
          </div>
          {mode === "exposure" && <div className="mt-1 text-[11px] text-primary">{exposureText(event.linked_trades)}</div>}
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${expanded ? "rotate-180 text-primary" : ""}`} />
      </button>
      {expanded && <EventDetails event={event} />}
    </div>
  );
}

function EventDetails({ event }: { event: NewsEvent }) {
  const cur = event.currency && event.currency !== "ALL" ? event.currency : null;
  const showScenarios = !!cur && event.impact !== "holiday" && !!event.forecast;

  return (
    <div className="border-t border-primary/15 bg-[#0c1211]/55 px-4 pb-5 pt-4 sm:px-6">
      <div className="grid gap-4 xl:grid-cols-4">
        <Metric label="Actual" value={value(event.actual, event.unit)} />
        <Metric label="Forecast" value={value(event.forecast, event.unit)} />
        <Metric label="Previous" value={value(event.previous, event.unit)} />
        <Metric label="Status" value={statusOf(event)} />
      </div>

      {showScenarios && (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Scenario title="Higher than forecast" icon={<TrendingUp className="h-4 w-4" />} tone="positive" headline={`${cur} supportive`} text={`A reading above forecast can support ${cur} through firmer rate expectations.`} />
          <Scenario title="Lower than forecast" icon={<TrendingDown className="h-4 w-4" />} tone="negative" headline={`${cur} negative`} text={`A reading below forecast can weigh on ${cur} through softer rate expectations.`} />
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Source</div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{event.source} · {dayLabel(event.event_time)}, {timeLabel(event.event_time)} ({TZ})</p>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Trade Vault context</div>
          <div className="mt-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-primary">{exposureText(event.linked_trades)}</div>
        </div>
      </div>

      {showScenarios && <div className="mt-5 rounded-xl border border-border bg-secondary/20 p-3 text-xs text-muted-foreground">Note: generic currency-level read only. Price action depends on what is already priced in.</div>}
    </div>
  );
}

function Scenario({ title, icon, tone, headline, text }: { title: string; icon: React.ReactNode; tone: "positive" | "negative"; headline: string; text: string }) {
  return (
    <div className={`rounded-2xl border p-4 ${tone === "positive" ? "border-emerald-400/20 bg-emerald-400/[.05]" : "border-rose-400/20 bg-rose-400/[.05]"}`}>
      <div className="flex items-center gap-2 text-sm font-semibold">{icon}{title}</div>
      <div className="mt-3 text-sm font-medium">{headline}</div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p>
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
