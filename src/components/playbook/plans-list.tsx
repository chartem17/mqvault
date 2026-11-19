"use client";

import { useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useTimezone } from "@/components/providers/timezone-provider";
import { useTrades, type JournalTrade } from "@/hooks/use-trades";
import { Button, Select } from "@/components/ui/primitives";
import { formatDateTimeOrDash } from "@/lib/time/timezone";
import { sameSymbol, type PlanMatch, type TradePlan } from "@/lib/playbook/plans";

const DAY_MS = 86_400_000;

/** Saved plans: what each became (a matched trade, still waiting, cancelled) with the few actions a plan allows. */
export function PlansList({ plans, match, onPatch, onDelete }: { plans: TradePlan[]; match: PlanMatch; onPatch: (body: { id: string; status?: "cancelled"; trade_id?: string | null }) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const { t, intl } = useI18n();
  const { timezone } = useTimezone();
  const { trades } = useTrades();
  const [linking, setLinking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const byId = new Map(trades.map(trade => [trade.id, trade]));
  const run = async (action: () => Promise<void>) => { setError(null); try { await action(); setLinking(null); } catch (reason) { setError(reason instanceof Error ? t(reason.message) : t("Action failed")); } };
  const candidates = (plan: TradePlan): JournalTrade[] => trades.filter(trade => trade.account_id === plan.account_id && trade.direction === plan.direction && sameSymbol(trade.symbol, plan.symbol) && Math.abs(Date.parse(trade.opened_at) - Date.parse(plan.created_at)) < DAY_MS && (!match.byTrade.has(trade.id) || match.byTrade.get(trade.id) === plan.id));

  if (!plans.length) return <p className="m-0 text-sm text-muted-foreground">{t("No plans yet. A plan is saved before the entry; the imported trade is matched to it automatically.")}</p>;
  return <div className="space-y-2">
    {error && <p role="alert" className="m-0 text-sm text-red">{error}</p>}
    <ul className="m-0 divide-y divide-border/60 p-0">
      {plans.slice(0, 40).map(plan => {
        const tradeId = match.byPlan.get(plan.id) ?? null;
        const trade = tradeId ? byId.get(tradeId) : undefined;
        const status = plan.status === "cancelled" ? t("Cancelled") : trade ? t("Trade {time}", { time: formatDateTimeOrDash(trade.opened_at, timezone, intl) }) : t("Waiting for the trade");
        return <li key={plan.id} className="list-none space-y-2 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-sm font-medium">{plan.symbol} <span className={plan.direction === "Long" ? "text-green" : "text-red"}>{plan.direction === "Long" ? t("Long") : t("Short")}</span>
              <span className="ml-2 text-xs font-normal text-muted-foreground">{formatDateTimeOrDash(plan.created_at, timezone, intl)}</span></span>
            <span className="text-xs tabular-nums text-muted-foreground">RR {plan.rr} · {plan.risk_pct}%{plan.risk_exception !== "none" && ` · ${plan.risk_exception === "add_on" ? t("add-on") : t("metals")}`} · <span className={plan.status === "cancelled" ? "" : trade ? "text-green" : "text-gold"}>{status}</span>{plan.trade_id && ` · ${t("linked by hand")}`}</span>
          </div>
          <p className="m-0 line-clamp-2 text-xs text-muted-foreground">{plan.reason}</p>
          <div className="flex flex-wrap gap-2">
            {plan.status === "active" && !trade && <Button size="sm" variant="ghost" onClick={() => run(() => onPatch({ id: plan.id, status: "cancelled" }))}>{t("Limit not filled — cancel")}</Button>}
            {plan.status === "active" && <Button size="sm" variant="ghost" onClick={() => setLinking(linking === plan.id ? null : plan.id)}>{t("Link a trade")}</Button>}
            {plan.trade_id && <Button size="sm" variant="ghost" onClick={() => run(() => onPatch({ id: plan.id, trade_id: null }))}>{t("Unlink")}</Button>}
            {plan.status === "cancelled" && <Button size="sm" variant="ghost" onClick={() => run(() => onDelete(plan.id))}>{t("Delete")}</Button>}
            {plan.screenshot_url && <a className="inline-flex min-h-8 items-center px-3 text-xs text-primary underline-offset-2 hover:underline" href={plan.screenshot_url} target="_blank" rel="noreferrer noopener">{t("Screenshot")}</a>}
          </div>
          {linking === plan.id && <div className="flex flex-wrap items-center gap-2">
            {candidates(plan).length ? <Select aria-label={t("Trade to link")} className="max-w-sm" defaultValue="" onChange={event => event.target.value && run(() => onPatch({ id: plan.id, trade_id: event.target.value }))}>
              <option value="">{t("Choose a trade")}</option>
              {candidates(plan).map(item => <option key={item.id} value={item.id}>{item.symbol} · {formatDateTimeOrDash(item.opened_at, timezone, intl)} · {item.entry_price}</option>)}
            </Select> : <span className="text-xs text-muted-foreground">{t("No trade of this instrument and direction within a day of the plan.")}</span>}
          </div>}
        </li>;
      })}
    </ul>
  </div>;
}
