"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useTrades } from "@/hooks/use-trades";
import { usePlaybook } from "@/hooks/use-playbook";
import { PlaybookStatus } from "@/components/playbook/playbook-status";
import { PlanForm } from "@/components/playbook/plan-form";
import { PlaybookRules } from "@/components/playbook/playbook-rules";
import { PlansList } from "@/components/playbook/plans-list";
import { TradeDisciplineList } from "@/components/playbook/trade-discipline";
import { DisciplineMetrics } from "@/components/playbook/discipline-metrics";
import { windowAt } from "@/lib/playbook/engine";

/** Rules / Playbook: the trading system, its state right now, trade plans and discipline marks. */
export function PlaybookTab() {
  const { t } = useI18n();
  const { visibleTrades, activeAccountId } = useTrades();
  const playbook = usePlaybook();
  const [now, setNow] = useState(() => new Date());
  const [planOpen, setPlanOpen] = useState(false);
  useEffect(() => { const id = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(id); }, []);
  const accountId = activeAccountId === "all" ? null : activeAccountId;
  const state = useMemo(() => accountId ? playbook.accountState(accountId, now) : null, [accountId, now, playbook]);
  const tradingWindow = useMemo(() => windowAt(now, playbook.config), [now, playbook.config]);
  const plans = accountId ? playbook.plans.filter(plan => plan.account_id === accountId) : playbook.plans;

  return <div className="mx-auto max-w-6xl space-y-14 pb-10 pt-2">
    <header className="space-y-2">
      <h1 className="m-0 text-2xl font-semibold">{t("Playbook")}</h1>
      <p className="m-0 max-w-2xl text-sm text-muted-foreground">{t("The trading system in one place: rules, a checklist that must pass before every entry, and how closely the trades follow it.")}</p>
    </header>
    {playbook.plansAvailable === false && <p role="status" className="m-0 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm">{t("Trade plans are not stored yet: the database migration for them waits for approval. The rules, the state and the automatic marks already work.")}</p>}

    <div className="grid gap-12 lg:grid-cols-2">
      <PlaybookStatus state={state} window={tradingWindow} config={playbook.config} onNewPlan={playbook.plansAvailable === false ? undefined : () => setPlanOpen(true)} />
      <DisciplineMetrics trades={visibleTrades} assessed={playbook.assessed} config={playbook.config} now={now} />
    </div>

    <div className="grid gap-12 lg:grid-cols-2">
      <section aria-label={t("Trade plans")} className="space-y-4"><h2 className="m-0 text-base font-semibold">{t("Trade plans")}</h2>
        {playbook.plansError && <p role="alert" className="m-0 text-sm text-red">{t(playbook.plansError)}</p>}
        <PlansList plans={plans} match={playbook.match} onPatch={playbook.patchPlan} onDelete={playbook.deletePlan} />
      </section>
      <section aria-label={t("Trades and discipline")} className="space-y-4"><h2 className="m-0 text-base font-semibold">{t("Trades and discipline")}</h2>
        <TradeDisciplineList trades={visibleTrades} assessed={playbook.assessed} />
      </section>
    </div>

    <section aria-label={t("Rules")} className="space-y-5"><h2 className="m-0 text-base font-semibold">{t("Rules")}</h2>
      <PlaybookRules config={playbook.config} onSave={playbook.saveConfig} />
    </section>

    <PlanForm open={planOpen} accountId={accountId} config={playbook.config} stateFor={playbook.accountState} onSave={playbook.createPlan} onClose={() => setPlanOpen(false)} />
  </div>;
}
