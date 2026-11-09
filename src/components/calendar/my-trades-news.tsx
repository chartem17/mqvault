"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useTrades, type JournalTrade } from "@/hooks/use-trades";
import { tradeNewsKey, useTradeNews } from "@/hooks/use-trade-news";
import { useI18n } from "@/components/providers/i18n-provider";
import { useTimezone } from "@/components/providers/timezone-provider";
import { edgeOffsetLabel } from "@/components/journal/trade-news";
import { surfaceClass } from "@/components/ui/surface-styles";
import { fmt } from "@/lib/journal/utils-trade";
import { MIN_SAMPLE } from "@/lib/journal/performance-breakdown";
import { edgeNewsLinks, splitByEdgeNews, type EdgeNewsLink, type NewsStats } from "@/lib/news/news-trades";

const GREEN = "var(--color-green)", RED = "var(--color-red)";
const tone = (value: number | null | undefined) => (value === null || value === undefined || value === 0 ? undefined : { color: value > 0 ? GREEN : RED });
const signedR = (value: number | null | undefined) => (value === null || value === undefined ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}R`);
const num = (value: number | string | null | undefined) => (value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? null : Number(value));

type Row = { trade: JournalTrade; open: number; close: number | null; news: EdgeNewsLink[] | null };

/**
 * Calendar → "My trades": the owner's trades of the selected week, each with the red releases within
 * 1 h of its entry or exit (ADR 0014), and an all-time comparison of results with and without such news.
 */
export function MyTradesNews({ week, nav }: { week: { from: number; to: number }; nav: ReactNode }) {
  const { trades, visibleTrades, loading: tradesLoading } = useTrades();
  const { t, tn, intl } = useI18n();
  const { timezone } = useTimezone();
  const key = useMemo(() => tradeNewsKey(trades), [trades]);
  const { byTrade, loading: newsLoading, error } = useTradeNews(key);
  const [onlyNews, setOnlyNews] = useState(false);

  const split = useMemo(() => (byTrade ? splitByEdgeNews(visibleTrades, byTrade) : null), [byTrade, visibleTrades]);
  const rows = useMemo<Row[]>(() => visibleTrades.flatMap(trade => {
    const open = Date.parse(trade.opened_at);
    if (!Number.isFinite(open) || open < week.from || open >= week.to) return [];
    const closed = trade.closed_at ? Date.parse(trade.closed_at) : NaN;
    const summary = byTrade?.get(trade.id);
    return [{ trade, open, close: Number.isFinite(closed) ? closed : null, news: summary ? edgeNewsLinks(summary.links) : null }];
  }).sort((a, b) => a.open - b.open), [visibleTrades, week, byTrade]);
  const withNews = rows.filter(row => row.news?.length).length;
  const shown = onlyNews ? rows.filter(row => row.news?.length) : rows;

  const f = useMemo(() => ({
    time: new Intl.DateTimeFormat(intl, { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }),
    dayTime: new Intl.DateTimeFormat(intl, { timeZone: timezone, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }),
    day: new Intl.DateTimeFormat(intl, { timeZone: timezone, weekday: "long", day: "numeric", month: "long" }),
    key: new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }),
  }), [intl, timezone]);
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; rows: Row[] }>();
    for (const row of shown) {
      const k = f.key.format(row.open);
      if (!map.has(k)) map.set(k, { label: f.day.format(row.open), rows: [] });
      map.get(k)!.rows.push(row);
    }
    return [...map.values()];
  }, [shown, f]);

  const stat = (label: string, stats: NewsStats, accent: boolean) => {
    const small = stats.trades < MIN_SAMPLE;
    return <div className={`rounded-xl border p-3 ${accent ? "border-red/25 bg-red/5" : "border-border bg-secondary/20"} ${small ? "opacity-60" : ""}`} title={small ? t("Small sample") : undefined}>
      <div className="text-xs font-semibold">{label}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{tn(stats.trades, "{count} trade", "{count} trades")}</div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs tabular-nums sm:grid-cols-4">
        <div><dt className="text-muted-foreground">{t("Win %")}</dt><dd className="m-0 text-sm font-semibold">{stats.winRate === null ? "—" : `${Math.round(stats.winRate)}%`}</dd></div>
        <div><dt className="text-muted-foreground">{t("Avg net")}</dt><dd className="m-0 text-sm font-semibold" style={tone(stats.avgNet)}>{stats.avgNet === null ? "—" : fmt.usd(stats.avgNet)}</dd></div>
        <div><dt className="text-muted-foreground">{t("Avg R")}</dt><dd className="m-0 text-sm font-semibold" style={tone(stats.avgR)}>{signedR(stats.avgR)}</dd></div>
        <div><dt className="text-muted-foreground">{t("Net P&L")}</dt><dd className="m-0 text-sm font-semibold" style={tone(stats.totalNet)}>{fmt.usd(stats.totalNet)}</dd></div>
      </dl>
    </div>;
  };

  const newsLine = (row: Row) => row.news === null
    ? <p className="m-0 mt-1 text-[11px] text-muted-foreground">{t("Not checked against the calendar")}</p>
    : row.news.length === 0
      ? <p className="m-0 mt-1 text-[11px] text-muted-foreground">{t("No red news within 1 h")}</p>
      : <ul className="m-0 mt-1 list-none space-y-0.5 p-0">{row.news.map(link => <li key={link.eventId} className="text-xs">
        <span className="font-medium text-red">{link.currency}</span> {link.title} <span className="text-muted-foreground">· {f.time.format(Date.parse(link.eventTime))} · {edgeOffsetLabel(link.edge, link.edgeMinutes, t)}</span>
      </li>)}</ul>;

  return <div className="space-y-5">
    <section className={surfaceClass("space-y-3 p-4")}>
      <div>
        <h2 className="m-0 text-sm font-semibold">{t("How red news affected your results")}</h2>
        <p className="m-0 mt-0.5 text-xs text-muted-foreground">{t("Closed trades, all time · red news = a high-impact release within 1 hour of entry or exit")}</p>
      </div>
      {(tradesLoading || newsLoading) && !split ? <p role="status" className="m-0 text-sm text-muted-foreground">{t("Loading…")}</p>
        : error ? <p className="m-0 text-sm text-muted-foreground">{t("Could not load the economic calendar.")}</p>
        : !split ? <p className="m-0 text-sm text-muted-foreground">{t("No calendar data for the period of your trades.")}</p>
        : <>
          <div className="grid gap-3 lg:grid-cols-2">{stat(t("With red news within 1 h"), split.withNews, true)}{stat(t("No red news within 1 h"), split.withoutNews, false)}</div>
          {split.unchecked > 0 && <p className="m-0 text-[11px] text-muted-foreground">{t("Not checked against the calendar: {count}", { count: split.unchecked })}</p>}
        </>}
    </section>

    <section className={surfaceClass("overflow-hidden")}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="m-0 text-sm font-semibold">{t("Your trades")}</h2>
          <p className="m-0 mt-0.5 text-xs text-muted-foreground">{tn(rows.length, "{count} trade", "{count} trades")} · {t("{count} with red news", { count: withNews })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" aria-pressed={onlyNews} onClick={() => setOnlyNews(v => !v)} className={`rounded-lg border px-3 py-1.5 text-xs ${onlyNews ? "border-red/30 bg-red/10 text-red" : "border-border bg-secondary/50 text-muted-foreground"}`}>{t("Only with red news")}</button>
          {nav}
        </div>
      </div>
      {tradesLoading ? <p role="status" className="m-0 px-4 py-10 text-center text-sm text-muted-foreground">{t("Loading…")}</p>
        : shown.length === 0 ? <p className="m-0 px-4 py-10 text-center text-sm text-muted-foreground">{onlyNews && rows.length ? t("No trades with red news this week.") : t("No trades this week.")}</p>
        : groups.map(group => <div key={group.label}>
          <div className="border-b border-border/70 bg-secondary/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</div>
          <div className="divide-y divide-border/70">{group.rows.map(row => {
            const net = num(row.trade.net_pnl), r = num(row.trade.result_r);
            const sameDay = row.close !== null && f.key.format(row.close) === f.key.format(row.open);
            return <Link key={row.trade.id} href={`/?tab=journal&focusTradeIds=${encodeURIComponent(row.trade.id)}`} title={t("Open in journal")}
              className={`grid grid-cols-[52px_minmax(0,1fr)_auto] items-start gap-3 px-4 py-3 hover:bg-secondary/35 ${row.news?.length ? "border-l-2 border-l-red/60" : "border-l-2 border-l-transparent"}`}>
              <div className="font-mono text-xs leading-5 text-muted-foreground">{f.time.format(row.open)}{row.close !== null && <div className="text-[10px] leading-4">→ {sameDay ? f.time.format(row.close) : f.dayTime.format(row.close)}</div>}</div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-sm"><span className="font-medium">{row.trade.symbol}</span><span className="text-xs" style={{ color: row.trade.direction === "Short" ? RED : GREEN }}>{row.trade.direction}</span></div>
                {newsLine(row)}
              </div>
              <div className="text-right text-sm tabular-nums">
                <div className="font-semibold" style={tone(net)}>{row.close === null ? t("Still open") : net === null ? "—" : fmt.usd(net)}</div>
                <div className="text-xs" style={tone(r)}>{signedR(r)}</div>
              </div>
            </Link>;
          })}</div>
        </div>)}
    </section>
  </div>;
}
