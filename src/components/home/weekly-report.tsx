"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { useTrades } from "@/hooks/use-trades";
import { useTimezone } from "@/components/providers/timezone-provider";
import { useI18n } from "@/components/providers/i18n-provider";
import { fmt } from "@/lib/journal/utils-trade";
import { shiftDay, dayKey } from "@/lib/time/timezone";
import { SESSION_DEFINITIONS } from "@/lib/time/sessions";
import { latestWeekWithTrades, weekStart, weeklyReport } from "@/lib/dashboard/weekly-report";

const POS = "var(--color-green)", NEG = "var(--color-red)";
const DISPLAY = { fontFamily: "var(--font-home-display), var(--font-ui), system-ui, sans-serif" } as const;
const signedR = (value: number | null) => (value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}R`);
const tone = (value: number | null) => (value === null || value === 0 ? undefined : { color: value > 0 ? POS : NEG });
const sessionLabel = (key: string) => SESSION_DEFINITIONS.find(session => session.key === key)?.label ?? key;

function useWeekLabel() {
  const { intl } = useI18n();
  return (start: string, end: string) => {
    const format = (day: string, withYear: boolean) => new Date(`${day}T12:00:00Z`).toLocaleDateString(intl, { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" });
    return `${format(start, false)} – ${format(end, true)}`;
  };
}

/** Home card: the latest week with trades in one line, opens the full report. */
export function WeeklySummary() {
  const router = useRouter();
  const { visibleTrades } = useTrades();
  const { timezone } = useTimezone();
  const { t, tn } = useI18n();
  const label = useWeekLabel();
  const report = useMemo(() => weeklyReport(visibleTrades, latestWeekWithTrades(visibleTrades, timezone), timezone), [visibleTrades, timezone]);
  return <section aria-label={t("Weekly report")} className="space-y-4">
    <h2 className="m-0 text-base font-semibold">{t("Weekly report")}</h2>
    {report.totals.trades === 0 ? <p className="m-0 text-muted-foreground">{t("No trades yet.")}</p> : <>
      <p className="m-0 text-sm text-muted-foreground">{label(report.start, report.end)} · {tn(report.totals.trades, "{count} trade", "{count} trades")}</p>
      <p className="m-0 flex flex-wrap items-baseline gap-x-6 gap-y-1"><span className="text-[1.65rem] font-medium tabular-nums" style={{ ...DISPLAY, ...tone(report.totals.withR ? report.totals.totalR : null) }}>{report.totals.withR ? signedR(report.totals.totalR) : "—"}</span><span className="tabular-nums" style={tone(report.totals.net)}>{fmt.usd(report.totals.net)}</span></p>
    </>}
    <Button variant="secondary" size="sm" type="button" onClick={() => router.push(`/?tab=home&report=week&week=${report.start}`, { scroll: false })}>{t("Open report")}</Button>
  </section>;
}

function Delta({ now, before, format }: { now: number | null; before: number | null; format: (value: number) => string }) {
  const { t } = useI18n();
  if (now === null || before === null) return null;
  const diff = Math.round((now - before) * 100) / 100;
  if (diff === 0) return <span className="text-xs text-muted-foreground">{t("same as the week before")}</span>;
  return <span className="text-xs" style={tone(diff)}>{t("{value} vs the week before", { value: `${diff > 0 ? "+" : "−"}${format(Math.abs(diff))}` })}</span>;
}

function Metric({ label, value, color, delta }: { label: string; value: string; color?: { color: string }; delta?: React.ReactNode }) {
  return <div className="min-w-0"><p className="m-0 text-[1.5rem] font-medium leading-none tabular-nums" style={{ ...DISPLAY, ...color }}>{value}</p><p className="mt-2 text-xs text-muted-foreground">{label}</p>{delta && <p className="m-0 mt-1">{delta}</p>}</div>;
}

/** Full weekly report: totals against the week before, days, best/worst, where, discipline. Copyable as text. */
export function WeeklyReportView({ week }: { week: string | null }) {
  const router = useRouter();
  const { visibleTrades, loading } = useTrades();
  const { timezone } = useTimezone();
  const { t, tn, intl } = useI18n();
  const label = useWeekLabel();
  const start = week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? weekStart(week) : latestWeekWithTrades(visibleTrades, timezone);
  const report = useMemo(() => weeklyReport(visibleTrades, start, timezone), [visibleTrades, start, timezone]);
  const [copied, setCopied] = useState("");
  const thisWeek = weekStart(dayKey(Date.now(), timezone));
  const go = (next: string | null) => router.push(next ? `/?tab=home&report=week&week=${next}` : "/?tab=home", { scroll: false });
  const p = report.previous, n = report.totals;
  const maxR = Math.max(...report.days.map(day => Math.abs(day.totalR)), 0.5);
  const weekday = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString(intl, { weekday: "short", timeZone: "UTC" });
  const tradeLine = (trade: { symbol: string; direction: string; opened_at: string; result_r?: number | null; net_pnl?: number | null }) => `${trade.symbol} ${trade.direction} · ${new Date(trade.opened_at).toLocaleString(intl, { timeZone: timezone, weekday: "short", hour: "2-digit", minute: "2-digit" })} · ${signedR(trade.result_r ?? null)} · ${typeof trade.net_pnl === "number" ? fmt.usd(trade.net_pnl) : "—"}`;
  const bestSymbol = report.symbols.find(row => row.withR && row.totalR > 0), worstSymbol = [...report.symbols].reverse().find(row => row.withR && row.totalR < 0);
  const bestSession = report.sessions.find(row => row.withR && row.totalR > 0), worstSession = [...report.sessions].reverse().find(row => row.withR && row.totalR < 0);

  function asText() {
    const lines = [
      `${t("Weekly report")} · ${label(report.start, report.end)}`,
      `${tn(n.trades, "{count} trade", "{count} trades")} · ${signedR(n.withR ? n.totalR : null)} · ${fmt.usd(n.net)} · ${t("Win %")}: ${n.winRate === null ? "—" : `${Math.round(n.winRate)}%`}`,
      report.best ? `${t("Best trade")}: ${tradeLine(report.best)}` : "",
      report.worst ? `${t("Worst trade")}: ${tradeLine(report.worst)}` : "",
      bestSymbol ? `${t("Best symbol")}: ${bestSymbol.key} ${signedR(bestSymbol.totalR)}` : "",
      worstSymbol ? `${t("Worst symbol")}: ${worstSymbol.key} ${signedR(worstSymbol.totalR)}` : "",
      `${t("Reviewed")}: ${report.discipline.reviewed}/${n.trades} · ${t("By plan")}: ${report.discipline.followed} · ${t("Not to plan")}: ${report.discipline.broken}`,
      ...report.discipline.mistakes.slice(0, 3).map(item => `${t("Mistake")}: ${t(item.mistake)} ×${item.trades} (${signedR(item.totalR)})`),
    ];
    return lines.filter(Boolean).join("\n");
  }
  async function copy() { try { await navigator.clipboard.writeText(asText()); setCopied(t("Copied")); } catch { setCopied(t("Could not copy")); } }

  if (loading) return <p role="status" className="text-sm text-muted-foreground">{t("Loading…")}</p>;
  return <div className="mx-auto max-w-5xl space-y-10 pb-10 pt-2">
    <header className="flex flex-wrap items-center gap-3">
      <Button variant="ghost" size="sm" onClick={() => go(null)}><ArrowLeft className="h-4 w-4" />{t("Home")}</Button>
      <h1 className="m-0 min-w-0 flex-1 text-2xl font-semibold" style={DISPLAY}>{t("Weekly report")}</h1>
      <div className="flex items-center gap-1">
        <Button variant="secondary" size="icon" aria-label={t("Previous week")} onClick={() => go(shiftDay(report.start, -7))}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="min-w-[10.5rem] text-center text-sm tabular-nums">{label(report.start, report.end)}</span>
        <Button variant="secondary" size="icon" aria-label={t("Next week")} disabled={report.start >= thisWeek} onClick={() => go(shiftDay(report.start, 7))}><ChevronRight className="h-4 w-4" /></Button>
      </div>
      <Button variant="secondary" size="sm" disabled={n.trades === 0} onClick={() => void copy()}><Copy className="h-4 w-4" />{t("Copy as text")}</Button>
      <span role="status" className="text-xs text-muted-foreground">{copied}</span>
    </header>

    {n.trades === 0 ? <p className="text-muted-foreground">{t("No trades this week.")}</p> : <>
      {n.trades < 5 && <p className="m-0 text-sm text-muted-foreground">{t("Fewer than 5 trades — read the numbers as notes, not conclusions.")}</p>}
      <section aria-label={t("Totals")} className="grid grid-cols-2 gap-x-10 gap-y-8 sm:grid-cols-4">
        <Metric label={tn(n.trades, "trade", "trades")} value={String(n.trades)} delta={<Delta now={n.trades} before={p.trades} format={value => String(value)} />} />
        <Metric label={t("Result in R")} value={n.withR ? signedR(n.totalR) : "—"} color={tone(n.withR ? n.totalR : null)} delta={<Delta now={n.withR ? n.totalR : null} before={p.withR ? p.totalR : null} format={value => `${value.toFixed(2)}R`} />} />
        <Metric label={t("Net P&L")} value={fmt.usd(n.net)} color={tone(n.net)} delta={<Delta now={n.net} before={p.trades ? p.net : null} format={value => `${value.toFixed(2)}$`} />} />
        <Metric label={t("Win %")} value={n.winRate === null ? "—" : `${Math.round(n.winRate)}%`} delta={<Delta now={n.winRate} before={p.winRate} format={value => `${Math.round(value)} pp`} />} />
      </section>

      <section aria-label={t("By day")} className="space-y-3">
        <h2 className="m-0 text-base font-semibold">{t("By day")}</h2>
        <ul className="m-0 grid list-none grid-cols-7 gap-2 p-0">{report.days.map(day => <li key={day.day} className="flex flex-col items-center gap-1.5 text-xs" title={`${day.day}: ${tn(day.trades, "{count} trade", "{count} trades")} · ${signedR(day.withR ? day.totalR : null)} · ${fmt.usd(day.net)}`}>
          <div className="relative h-24 w-full max-w-10" aria-hidden="true"><div className="absolute inset-x-0 top-1/2 h-px bg-border" />{day.withR > 0 && <div className="absolute inset-x-1 rounded-sm" style={{ background: day.totalR >= 0 ? POS : NEG, height: `${Math.max((Math.abs(day.totalR) / maxR) * 50, 2)}%`, [day.totalR >= 0 ? "bottom" : "top"]: "50%" }} />}</div>
          <span className="font-medium">{weekday(day.day)}</span>
          <span className="tabular-nums" style={tone(day.withR ? day.totalR : null)}>{day.trades ? signedR(day.withR ? day.totalR : null) : "·"}</span>
          <span className="tabular-nums text-muted-foreground">{day.trades || ""}</span>
        </li>)}</ul>
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <section aria-label={t("Best and worst")} className="space-y-3">
          <h2 className="m-0 text-base font-semibold">{t("Best and worst")}</h2>
          <dl className="m-0 space-y-2 text-sm">
            {[[t("Best trade"), report.best ? tradeLine(report.best) : null, report.best?.id], [t("Worst trade"), report.worst ? tradeLine(report.worst) : null, report.worst?.id]].map(([name, value, id]) => <div key={name} className="flex flex-wrap items-baseline justify-between gap-x-4"><dt className="text-muted-foreground">{name}</dt><dd className="m-0">{value ? <button type="button" className="text-left hover:underline" onClick={() => router.push(`/journal?focusTradeIds=${encodeURIComponent(id as string)}`)}>{value}</button> : "—"}</dd></div>)}
            <div className="flex flex-wrap items-baseline justify-between gap-x-4"><dt className="text-muted-foreground">{t("Best symbol")}</dt><dd className="m-0">{bestSymbol ? <>{bestSymbol.key} <span style={tone(bestSymbol.totalR)}>{signedR(bestSymbol.totalR)}</span></> : "—"}</dd></div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4"><dt className="text-muted-foreground">{t("Worst symbol")}</dt><dd className="m-0">{worstSymbol ? <>{worstSymbol.key} <span style={tone(worstSymbol.totalR)}>{signedR(worstSymbol.totalR)}</span></> : "—"}</dd></div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4"><dt className="text-muted-foreground">{t("Best session")}</dt><dd className="m-0">{bestSession ? <>{t(sessionLabel(bestSession.key))} <span style={tone(bestSession.totalR)}>{signedR(bestSession.totalR)}</span></> : "—"}</dd></div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4"><dt className="text-muted-foreground">{t("Worst session")}</dt><dd className="m-0">{worstSession ? <>{t(sessionLabel(worstSession.key))} <span style={tone(worstSession.totalR)}>{signedR(worstSession.totalR)}</span></> : "—"}</dd></div>
          </dl>
        </section>

        <section aria-label={t("Discipline")} className="space-y-3">
          <h2 className="m-0 text-base font-semibold">{t("Discipline")}</h2>
          <dl className="m-0 space-y-2 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t("Reviewed")}</dt><dd className="m-0 tabular-nums">{report.discipline.reviewed} / {n.trades}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t("By plan / not to plan")}</dt><dd className="m-0 tabular-nums"><span style={{ color: POS }}>{report.discipline.followed}</span> / <span style={{ color: NEG }}>{report.discipline.broken}</span></dd></div>
          </dl>
          {report.discipline.mistakes.length > 0 ? <ul className="m-0 list-none divide-y divide-border/60 p-0 text-sm">{report.discipline.mistakes.slice(0, 5).map(item => <li key={item.mistake} className="flex justify-between gap-4 py-2"><span>{t(item.mistake)} <span className="text-muted-foreground">×{item.trades}</span></span><span className="tabular-nums" style={tone(item.totalR)}>{signedR(item.totalR)}</span></li>)}</ul>
            : <p className="m-0 text-sm text-muted-foreground">{t("No mistakes marked this week.")}</p>}
          {report.discipline.waiting > 0 && <Button variant="secondary" size="sm" onClick={() => router.push("/?tab=journal&review=1", { scroll: false })}>{tn(report.discipline.waiting, "Review {count} trade", "Review {count} trades")}</Button>}
        </section>
      </div>
    </>}
  </div>;
}
