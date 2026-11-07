"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTrades } from "@/hooks/use-trades";
import { useStrategies } from "@/hooks/use-strategies";
import { useTimezone } from "@/components/providers/timezone-provider";
import { DayDial } from "@/components/home/day-dial";
import { Button } from "@/components/ui/primitives";
import { dailyLossRoom, greetingFor, lastDays, summarizeToday, unmarkedTrades, type StrategyLimits } from "@/lib/dashboard/home-summary";
import { getSessionGroup } from "@/lib/time/sessions";
import { formatDateTimeOrDash, zonedParts } from "@/lib/time/timezone";
import { fmt } from "@/lib/journal/utils-trade";
import { useI18n } from "@/components/providers/i18n-provider";

const POS = "var(--color-green)", NEG = "var(--color-red)";
const DISPLAY = { fontFamily: "var(--font-home-display), var(--font-ui), system-ui, sans-serif" } as const;
const SESSION_NAME = { asia: "Asia", london: "London", new_york: "New York", off: "" } as const;

/** Row of dots: how much of a daily limit is used. The last dot turns red once the limit is reached. */
function Rail({ label, used, limit, fallback }: { label: string; used: number; limit: number | null; fallback: string }) {
  const { t } = useI18n();
  if (limit === null) return <div className="flex items-baseline justify-between gap-6"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="m-0 text-sm text-muted-foreground">{used} · {fallback}</dd></div>;
  const reached = used >= limit;
  return <div className="flex items-center justify-between gap-6">
    <dt className="text-sm text-foreground">{label}</dt>
    <dd className="m-0 flex items-center gap-3">
      <span className="flex gap-1.5" aria-hidden="true">{Array.from({ length: Math.min(limit, 12) }).map((_, index) => <span key={index} className="h-2.5 w-2.5 rounded-full border" style={{ borderColor: index < used ? (reached ? NEG : POS) : "var(--color-border)", background: index < used ? (reached ? NEG : POS) : "transparent" }} />)}</span>
      <span className="min-w-[3.5rem] text-right text-sm tabular-nums" style={{ color: reached ? NEG : undefined }}>{t("{used} of {limit}", { used, limit })}</span>
    </dd>
  </div>;
}

function Figure({ value, label, color }: { value: string; label: string; color?: string }) {
  return <div><p className="m-0 text-[1.65rem] font-medium leading-none tabular-nums" style={{ ...DISPLAY, color }}>{value}</p><p className="mt-2 text-xs text-muted-foreground">{label}</p></div>;
}

/** Entry page: a welcome, the day as a dial, discipline for today, what still needs a review and the last two weeks. */
export function HomeTab() {
  const router = useRouter();
  const { t, tn, intl } = useI18n();
  const { visibleTrades, activeAccount, activeAccountId, loading } = useTrades();
  const { timezone } = useTimezone();
  const { activeStrategy } = useStrategies();
  const now = useMemo(() => new Date(), []);

  const limits = useMemo<StrategyLimits>(() => {
    const value = (type: string) => { const rule = activeStrategy?.rules.find(item => item.ruleType === type && item.enabled); const limit = Number(rule?.params.limit); return Number.isFinite(limit) && limit > 0 ? limit : null; };
    return { maxTrades: value("max_trades_per_day"), maxLosses: value("max_losses_per_day") };
  }, [activeStrategy]);
  const today = useMemo(() => summarizeToday(visibleTrades, timezone, now, limits), [visibleTrades, timezone, now, limits]);
  const days = useMemo(() => lastDays(visibleTrades, timezone, 14, now), [visibleTrades, timezone, now]);
  const unmarked = useMemo(() => unmarkedTrades(visibleTrades), [visibleTrades]);
  const recentUnmarked = useMemo(() => [...unmarked].sort((a, b) => b.opened_at.localeCompare(a.opened_at)).slice(0, 5), [unmarked]);
  const todayDots = useMemo(() => visibleTrades.filter(trade => zonedParts(trade.opened_at, timezone).date === today.day), [visibleTrades, timezone, today.day]);

  const known = visibleTrades.filter(trade => typeof trade.net_pnl === "number");
  const net = known.reduce((sum, trade) => sum + (trade.net_pnl as number), 0);
  const rs = visibleTrades.filter(trade => typeof trade.result_r === "number").map(trade => trade.result_r as number);
  const avgR = rs.length ? rs.reduce((sum, value) => sum + value, 0) / rs.length : null;
  const winRate = known.length ? known.filter(trade => (trade.net_pnl as number) > 0).length / known.length * 100 : null;
  const room = activeAccount?.accountType === "prop" ? dailyLossRoom(activeAccount.initialBalance, activeAccount.dailyLossPercent ?? null, today.netPnl) : null;
  const scope = activeAccountId === "all" ? t("All selected accounts") : activeAccount?.name ?? t("Account");
  const session = SESSION_NAME[getSessionGroup(now)];
  const summary = today.opened === 0 && today.closedCount === 0
    ? `${t("No trades yet today.")} ${session ? t("The {session} session is on now.", { session }) : t("Outside the main sessions right now.")}`
    : today.closedCount > 0 && today.netPnl !== null
      ? tn(today.opened, "{count} trade opened today, closed trades made {pnl}.", "{count} trades opened today, closed trades made {pnl}.", { pnl: fmt.usd(today.netPnl) })
      : tn(today.opened, "{count} trade opened today.", "{count} trades opened today.");
  const maxAbs = Math.max(...days.map(item => Math.abs(item.net)), 1);
  const step = days.length > 1 ? 520 / (days.length - 1) : 0;

  if (loading) return <p role="status" className="text-sm text-muted-foreground">{t("Loading…")}</p>;
  return <div className="mx-auto max-w-6xl space-y-16 pb-10 pt-2">
    <section className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(320px,440px)] lg:gap-16" aria-label={t("Today")}>
      <div className="space-y-8">
        <div className="space-y-4">
          <p className="m-0 text-sm text-muted-foreground">{scope}</p>
          <h1 className="m-0 text-[clamp(2rem,4.2vw,3.1rem)] font-semibold leading-[1.08] tracking-[-0.015em]" style={DISPLAY}>{t(greetingFor(zonedParts(now, timezone).hour))}</h1>
          <p className="m-0 max-w-[34ch] text-lg leading-relaxed text-muted-foreground">{summary}</p>
        </div>
        <dl className="m-0 max-w-md space-y-4">
          <Rail label={t("Trades opened")} used={today.opened} limit={today.limits.maxTrades} fallback={activeAccountId === "all" ? t("pick an account for limits") : t("no limit set")} />
          <Rail label={t("Losing")} used={today.losses} limit={today.limits.maxLosses} fallback={activeAccountId === "all" ? t("pick an account for limits") : t("no limit set")} />
          {activeAccount?.accountType === "prop" && <div className="flex items-baseline justify-between gap-6"><dt className="text-sm text-foreground">{t("Room to daily limit")}</dt><dd className="m-0 text-sm tabular-nums text-muted-foreground">{room ? t("≈ {room} of {limit} {currency}", { room: fmt.num(room.room, 2), limit: fmt.num(room.limit, 2), currency: activeAccount.currency }) : t("not set in the rules")}</dd></div>}
        </dl>
      </div>
      <DayDial trades={todayDots} timezone={timezone} now={now} netToday={today.netPnl} />
    </section>

    <section aria-label={t("Summary")} className="flex flex-wrap gap-x-14 gap-y-8">
      <Figure value={fmt.usd(net)} label={t("Net P&L")} color={net === 0 ? undefined : net > 0 ? POS : NEG} />
      <Figure value={winRate === null ? "—" : fmt.pct(winRate)} label={t("Winrate")} />
      <Figure value={avgR === null ? "—" : fmt.r(avgR)} label={t("Average R")} color={avgR === null || avgR === 0 ? undefined : avgR > 0 ? POS : NEG} />
      <Figure value={String(visibleTrades.length)} label={tn(visibleTrades.length, "trade", "trades")} />
    </section>

    <div className="grid gap-12 sm:gap-16 lg:grid-cols-2">
      <section aria-label={t("Day review")} className="space-y-5">
        <h2 className="m-0 text-base font-semibold">{t("Needs review")}</h2>
        {unmarked.length === 0 ? <p className="m-0 text-muted-foreground">{t("Everything is marked.")}</p> : <>
          <p className="m-0 text-muted-foreground"><span className="mr-2 text-[2rem] font-medium tabular-nums text-foreground" style={DISPLAY}>{unmarked.length}</span>{tn(unmarked.length, "trade waiting for review", "trades waiting for review")}</p>
          <ul className="m-0 max-w-md list-none divide-y divide-border/60 p-0">{recentUnmarked.map(trade => <li key={trade.id} className="flex items-baseline justify-between gap-4 py-2.5 text-sm"><span>{trade.symbol} <span className="text-muted-foreground">{trade.direction === "Short" ? "short" : "long"}</span></span><span className="text-xs tabular-nums text-muted-foreground">{formatDateTimeOrDash(trade.opened_at, timezone, intl)}</span></li>)}</ul>
          <Button variant="secondary" size="sm" type="button" onClick={() => router.push("/?tab=journal&review=1", { scroll: false })}>{t("Start review")}</Button>
        </>}
      </section>

      <section aria-label={t("Last 14 days")} className="space-y-5">
        <h2 className="m-0 text-base font-semibold">{t("Last 14 days")}</h2>
        <svg viewBox="0 0 560 150" role="img" aria-label={t("Net P&L over the last 14 days")} className="block h-auto w-full overflow-visible">
          <line x1={20} y1={75} x2={540} y2={75} stroke="currentColor" strokeOpacity={0.15} strokeDasharray="2 5" />
          {days.map((item, index) => { const x = 20 + index * step, y = 75 - item.net / maxAbs * 62;
            return item.count === 0 ? <circle key={item.day} cx={x} cy={75} r={2} fill="currentColor" fillOpacity={0.3} /> : <g key={item.day}><title>{`${item.day}: ${fmt.usd(item.net)} · ${tn(item.count, "{count} trade", "{count} trades")}`}</title><line x1={x} y1={75} x2={x} y2={y} stroke={item.net >= 0 ? POS : NEG} strokeWidth={2} strokeLinecap="round" /><circle cx={x} cy={y} r={5.5} fill={item.net >= 0 ? POS : NEG} /></g>; })}
        </svg>
        <div className="flex justify-between text-xs tabular-nums text-muted-foreground"><span>{days[0]?.day.slice(5).replace("-", ".")}</span><span>{days[days.length - 1]?.day.slice(5).replace("-", ".")}</span></div>
      </section>
    </div>
  </div>;
}
