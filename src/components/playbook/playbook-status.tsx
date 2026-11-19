"use client";

import { Ban, CircleCheck, Clock, Plus } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/primitives";
import type { PlaybookConfig } from "@/lib/playbook/config";
import type { DayStatus, RiskState, WindowNow } from "@/lib/playbook/engine";
import { zonedParts } from "@/lib/time/timezone";

export type AccountPlaybookState = { window: WindowNow; day: DayStatus; risk: RiskState };

/** Why the risk is what it is, in one line. */
export function riskReason(risk: RiskState, config: PlaybookConfig, t: (text: string, vars?: Record<string, string | number>) => string): string {
  if (risk.level === "reduced") return t("Reduced after {count} losses in a row · {wins} of {need} wins at {pct}% to go back", { count: config.lossesToReduce, wins: risk.winsAtReduced, need: config.winsToRestore, pct: config.reducedRiskPct });
  return risk.lossStreak > 0
    ? t("Base risk · {count} of {max} losses in a row", { count: risk.lossStreak, max: config.lossesToReduce })
    : t("Base risk · no losing streak");
}

function Counter({ label, used, max }: { label: string; used: number; max: number }) {
  const { t } = useI18n();
  const full = used >= max;
  return <div className="flex items-baseline justify-between gap-4">
    <dt className="text-sm text-muted-foreground">{label}</dt>
    <dd className={`m-0 text-sm font-medium tabular-nums ${full ? "text-red" : "text-foreground"}`}>{t("{used} of {limit}", { used, limit: max })}</dd>
  </div>;
}

/**
 * "Can I trade now?" by the trading system: window, trades and stops today, the risk to use and why.
 * Without an account (All accounts) only the window is shown: limits and risk belong to one account.
 */
export function PlaybookStatus({ state, window, config, onNewPlan, compact = false }: { state: AccountPlaybookState | null; window: WindowNow; config: PlaybookConfig; onNewPlan?: () => void; compact?: boolean }) {
  const { t, intl } = useI18n();
  /** Time on the playbook clock; the weekday is added when it is not the playbook's today. */
  const time = (iso: string) => new Date(iso).toLocaleString(intl, { timeZone: config.timezone, hour: "2-digit", minute: "2-digit", ...(zonedParts(iso, config.timezone).date === window.day ? {} : { weekday: "short" }) });
  const blocked = state?.day.blockedBy ?? null;
  const canEnter = window.entriesAllowed && !blocked;
  const windowLine = window.window
    ? `${t(window.window.label)} · ${t("until {time}", { time: window.endsAt ? time(window.endsAt) : "—" })}`
    : t("No trading window now");

  return <section aria-label={t("Trading system now")} className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="m-0 flex items-center gap-2 text-base font-semibold"><Clock className="h-4 w-4 text-primary" aria-hidden="true" />{t("Trading system now")}</h2>
      <span role="status" className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${canEnter ? "border-green/40 bg-green/10 text-green" : "border-red/40 bg-red/10 text-red"}`}>
        {canEnter ? <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" /> : <Ban className="h-3.5 w-3.5" aria-hidden="true" />}
        {canEnter ? t("Entries allowed") : blocked === "losses" ? t("Blocked until tomorrow") : blocked === "trades" ? t("Daily trade limit used") : window.window ? t("Observe only") : t("No entries now")}
      </span>
    </div>
    <dl className="m-0 space-y-2.5">
      <div className="flex items-baseline justify-between gap-4"><dt className="text-sm text-muted-foreground">{t("Window")}</dt><dd className="m-0 text-right text-sm">{windowLine}
        {!window.entriesAllowed && window.next && <span className="block text-xs text-muted-foreground">{t("Next: {window} at {time}", { window: t(window.next.window.label), time: time(window.next.startsAt) })}</span>}</dd></div>
      {state ? <>
        <Counter label={t("Trades today")} used={state.day.entries} max={state.day.maxTrades} />
        <Counter label={t("Stops today")} used={state.day.losses} max={state.day.maxLosses} />
        <div className="flex items-baseline justify-between gap-4"><dt className="text-sm text-muted-foreground">{t("Risk per trade")}</dt>
          <dd className="m-0 text-right"><span className={`text-sm font-medium tabular-nums ${state.risk.level === "reduced" ? "text-gold" : "text-foreground"}`}>{state.risk.riskPct}%</span>
            {!compact && <span className="block text-xs text-muted-foreground">{riskReason(state.risk, config, t)}</span>}</dd></div>
      </> : <p className="m-0 text-xs text-muted-foreground">{t("Pick an account to see its limits and risk.")}</p>}
    </dl>
    {onNewPlan && <Button size="sm" onClick={onNewPlan} disabled={!state}><Plus className="h-4 w-4" aria-hidden="true" />{t("New trade plan")}</Button>}
  </section>;
}
