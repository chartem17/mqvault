"use client";
import { useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTrades } from "@/hooks/use-trades";
import { useStrategies } from "@/hooks/use-strategies";
import { useTimezone } from "@/components/providers/timezone-provider";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/primitives";
import { surfaceClass } from "@/components/ui/surface-styles";
import { dailyLossRoom, lastDays, summarizeToday, unmarkedTrades, type StrategyLimits } from "@/lib/home-summary";
import { formatDateTimeOrDash } from "@/lib/timezone";
import { fmt } from "@/lib/utils-trade";

const POS = "var(--color-green)", NEG = "var(--color-red)";

function Block({ title, hint, children, className }: { title: string; hint?: string; children: ReactNode; className?: string }) {
  return <section className={surfaceClass(`p-5 ${className ?? ""}`)}><div className="mb-4"><h2 className="text-sm font-semibold text-foreground">{title}</h2>{hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}</div>{children}</section>;
}

function Gauge({ label, used, limit, hint }: { label: string; used: number; limit: number | null; hint?: string }) {
  const ratio = limit && limit > 0 ? Math.min(1, used / limit) : 0;
  const over = limit !== null && used >= limit;
  return <div>
    <div className="flex items-baseline justify-between text-sm"><span className="text-muted-foreground">{label}</span><span className="font-semibold tabular-nums text-foreground">{used}{limit !== null ? ` / ${limit}` : ""}</span></div>
    {limit !== null ? <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={Math.min(used, limit)} className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full" style={{ width: `${ratio * 100}%`, background: over ? NEG : POS }} /></div> : <p className="mt-1 text-[11px] text-muted-foreground">{hint ?? "Ліміт не задано у стратегії"}</p>}
  </div>;
}

/** Entry page: short metrics, today, day review and a glance at the last two weeks. */
export function HomeTab() {
  const router = useRouter();
  const { visibleTrades, activeAccount, activeAccountId, loading } = useTrades();
  const { timezone } = useTimezone();
  const { activeStrategy } = useStrategies();

  const limits = useMemo<StrategyLimits>(() => {
    const rule = (type: string) => activeStrategy?.rules.find(item => item.ruleType === type && item.enabled);
    const value = (type: string) => { const limit = Number(rule(type)?.params.limit); return Number.isFinite(limit) && limit > 0 ? limit : null; };
    return { maxTrades: value("max_trades_per_day"), maxLosses: value("max_losses_per_day") };
  }, [activeStrategy]);
  const today = useMemo(() => summarizeToday(visibleTrades, timezone, new Date(), limits), [visibleTrades, timezone, limits]);
  const days = useMemo(() => lastDays(visibleTrades, timezone, 14), [visibleTrades, timezone]);
  const unmarked = useMemo(() => unmarkedTrades(visibleTrades), [visibleTrades]);
  const recentUnmarked = useMemo(() => [...unmarked].sort((a, b) => b.opened_at.localeCompare(a.opened_at)).slice(0, 5), [unmarked]);

  const known = visibleTrades.filter(trade => typeof trade.net_pnl === "number");
  const net = known.reduce((sum, trade) => sum + (trade.net_pnl as number), 0);
  const wins = known.filter(trade => (trade.net_pnl as number) > 0).length;
  const rs = visibleTrades.filter(trade => typeof trade.result_r === "number").map(trade => trade.result_r as number);
  const avgR = rs.length ? rs.reduce((sum, value) => sum + value, 0) / rs.length : null;
  const room = activeAccount?.accountType === "prop" ? dailyLossRoom(activeAccount.initialBalance, activeAccount.dailyLossPercent ?? null, today.netPnl) : null;
  const maxAbs = Math.max(...days.map(item => Math.abs(item.net)), 1);
  const scope = activeAccountId === "all" ? "Усі вибрані рахунки" : activeAccount?.name ?? "Рахунок";
  const openJournal = () => router.push("/?tab=journal", { scroll: false });

  return <div className="space-y-6">
    <SectionHeader title="Головна" sub={`${scope} · ${new Intl.DateTimeFormat("uk-UA", { timeZone: timezone, weekday: "long", day: "numeric", month: "long" }).format(new Date())}`} />
    {loading ? <p role="status" className="text-sm text-muted-foreground">Завантаження…</p> : <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Net P&L" value={fmt.usd(net)} colorClass={net >= 0 ? "text-green" : "text-red"} />
        <StatCard label="Winrate" value={known.length ? fmt.pct(wins / known.length * 100) : "—"} colorClass="text-foreground" />
        <StatCard label="Avg R" value={avgR === null ? "—" : fmt.r(avgR)} colorClass={avgR !== null && avgR < 0 ? "text-red" : "text-green"} />
        <StatCard label="Угод" value={String(visibleTrades.length)} colorClass="text-foreground" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Block title="Сьогодні" hint="День у вашому часовому поясі. Кількість угод — за часом відкриття, P&L — за часом закриття.">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-4">
              <Gauge label="Угод відкрито" used={today.opened} limit={today.limits.maxTrades} hint={activeAccountId === "all" ? "Оберіть рахунок, щоб бачити ліміти стратегії" : undefined} />
              <Gauge label="Збиткових угод" used={today.losses} limit={today.limits.maxLosses} hint={activeAccountId === "all" ? "Оберіть рахунок, щоб бачити ліміти стратегії" : undefined} />
            </div>
            <div className="space-y-2 rounded-xl bg-secondary/40 p-4">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Результат за сьогодні</p>
              <p className="text-2xl font-semibold tabular-nums" style={{ color: today.netPnl === null || today.netPnl === 0 ? undefined : today.netPnl > 0 ? POS : NEG }}>{today.netPnl === null ? "—" : fmt.usd(today.netPnl)}</p>
              <p className="text-xs text-muted-foreground">Закрито угод: {today.closedCount} · прибуткових {today.wins}, збиткових {today.losses}</p>
              {activeAccount?.accountType === "prop" && (room ? <p className="text-xs text-foreground">До денного ліміту ≈ {fmt.num(room.room, 2)} з {fmt.num(room.limit, 2)} {activeAccount.currency} <span className="text-muted-foreground">(за журналом, орієнтовно)</span></p> : <p className="text-xs text-muted-foreground">Денний ліміт збитку не задано в умовах рахунку.</p>)}
            </div>
          </div>
        </Block>
        <Block title="Розбір дня" hint="Угоди без сетапу або емоції. Позначки потрібні, щоб Контроль стратегії бачив повну картину.">
          <div className="flex items-end justify-between gap-3"><p className="text-3xl font-semibold tabular-nums text-foreground">{unmarked.length}</p><Button variant="secondary" size="sm" type="button" onClick={openJournal}>Відкрити журнал</Button></div>
          {recentUnmarked.length > 0 ? <ul className="mt-4 divide-y divide-border/70 text-sm">{recentUnmarked.map(trade => <li key={trade.id} className="flex items-center justify-between gap-3 py-2"><span className="text-foreground">{trade.symbol} <span className="text-xs text-muted-foreground">{trade.direction}</span></span><span className="text-xs text-muted-foreground">{formatDateTimeOrDash(trade.opened_at, timezone)}</span></li>)}</ul> : <p className="mt-4 text-sm text-muted-foreground">Усі угоди позначені.</p>}
        </Block>
      </div>
      <Block title="Останні 14 днів" hint="Net P&L за днями закриття угод.">
        <div className="flex h-32 items-end gap-1.5" role="img" aria-label="Net P&L за останні 14 днів">
          {days.map(item => <div key={item.day} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${item.day}: ${fmt.usd(item.net)} · ${item.count} угод`}><div className="w-full rounded-sm" style={{ height: `${Math.max(item.count ? 6 : 2, Math.abs(item.net) / maxAbs * 100)}%`, background: item.count === 0 ? "var(--border)" : item.net >= 0 ? POS : NEG, opacity: item.count === 0 ? 0.5 : 0.9 }} /></div>)}
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground"><span>{days[0]?.day.slice(5)}</span><span>{days[days.length - 1]?.day.slice(5)}</span></div>
      </Block>
    </>}
  </div>;
}
