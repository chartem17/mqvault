"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useTimezone } from "@/components/providers/timezone-provider";
import { zonedParts } from "@/lib/time/timezone";
import { activeNewsWindow, upcomingEvents } from "@/lib/news/news-trades";
import type { CalendarEvent } from "@/lib/news/economic-calendar";

const NEG = "var(--color-red)";
const REFRESH_MS = 15 * 60_000;
const LOOKBACK_MIN = 240;

/**
 * High-impact releases for the currencies the owner trades (from 4 h ago to +7 days), refreshed every
 * 15 minutes: the next ones, and — when the strategy has the red-news rule — the ±N window now is in.
 */
export function useRedNews(now: Date, blackoutMinutes: number | null) {
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => { const id = window.setInterval(() => setTick(value => value + 1), REFRESH_MS); return () => window.clearInterval(id); }, []);
  useEffect(() => {
    let cancelled = false;
    const start = Date.now();
    const query = new URLSearchParams({ from: new Date(start - LOOKBACK_MIN * 60_000).toISOString(), to: new Date(start + 7 * 86_400_000).toISOString(), impact: "high" });
    fetch(`/api/economic-calendar?${query}`, { cache: "no-store", credentials: "same-origin" })
      .then(response => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((payload: { events?: CalendarEvent[] }) => { if (!cancelled) { setEvents(Array.isArray(payload.events) ? payload.events : []); setFailed(false); } })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [tick]);

  const nowMs = now.getTime();
  const next = useMemo(() => (events ? upcomingEvents(events, nowMs, 2) : []), [events, nowMs]);
  const window_ = useMemo(() => (events && blackoutMinutes ? activeNewsWindow(events, nowMs, blackoutMinutes) : null), [events, nowMs, blackoutMinutes]);
  return { loaded: events !== null, failed, next, window: window_ };
}

function useWhen(now: Date) {
  const { intl } = useI18n();
  const { timezone } = useTimezone();
  const todayKey = zonedParts(now, timezone).date;
  return (iso: string) => new Date(iso).toLocaleString(intl, { timeZone: timezone, hour: "2-digit", minute: "2-digit", ...(zonedParts(iso, timezone).date === todayKey ? {} : { weekday: "short" }) });
}

/** "Next red news" row of the Today list (inside a <dl>). */
export function NextNewsRow({ now, news }: { now: Date; news: ReturnType<typeof useRedNews> }) {
  const { t } = useI18n();
  const when = useWhen(now);
  const nowMs = now.getTime();
  const { failed, next } = news;

  const inMinutes = (iso: string) => {
    const minutes = Math.max(0, Math.round((Date.parse(iso) - nowMs) / 60_000));
    if (minutes < 1) return t("now");
    if (minutes < 60) return t("in {minutes} min", { minutes });
    if (minutes < 24 * 60) return t("in {hours} h {minutes} min", { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
    return null;
  };

  return <div className="flex items-baseline justify-between gap-6"><dt className="shrink-0 text-sm text-foreground">{t("Next red news")}</dt><dd className="m-0 min-w-0 text-right text-sm text-muted-foreground">
      {failed ? t("calendar unavailable") : !news.loaded ? "…" : next.length === 0 ? t("none in the next 7 days") : next.map((event, index) => {
        const soon = inMinutes(event.time);
        return <span key={event.id} className={index === 0 ? "block" : "block text-xs"}>
          {index === 0 ? <span className="text-foreground">{event.currency} · {event.title}</span> : <>{event.currency} · {event.title}</>}
          {" · "}{when(event.time)}{soon && index === 0 ? <> · <span style={Date.parse(event.time) - nowMs <= 60 * 60_000 ? { color: NEG } : undefined}>{soon}</span></> : null}
        </span>;
      })}
    </dd></div>;
}

/** Warning shown while now is inside the strategy's ±N minute window around a red release. */
export function NewsWindowWarning({ now, news }: { now: Date; news: ReturnType<typeof useRedNews> }) {
  const { t } = useI18n();
  const when = useWhen(now);
  const active = news.window;
  if (!active) return null;
  return <p role="status" className="m-0 max-w-md rounded-xl border px-4 py-3 text-sm" style={{ borderColor: NEG, color: NEG }}>
    {t("Red news window: {currency} {title} at {time}. The strategy says no new trades until {until}.", { currency: active.event.currency ?? "", title: active.event.title, time: when(active.event.time), until: when(active.endsAt) })}
  </p>;
}
