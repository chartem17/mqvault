"use client";

import { useState } from "react";
import { useTrades } from "@/hooks/use-trades";
import { useDashboardLayout } from "@/hooks/use-dashboard-layout";
import { accountOverviewLabel } from "@/lib/account-overview";
import { AccountRulesCard } from "@/components/accounts/account-rules-card";
import { SectionHeader } from "@/components/ui/section-header";
import { DashboardGrid } from "@/components/overview/dashboard-grid";
import { DashboardToolbar } from "@/components/overview/dashboard-toolbar";
import { useI18n } from "@/components/providers/i18n-provider";

export function OverviewTab() {
  const { visibleTrades, activeAccount, activeAccountId } = useTrades();
  const dashboard = useDashboardLayout();
  const [editing, setEditing] = useState(false);
  const { t, tn } = useI18n();
  const count = tn(visibleTrades.length, "{count} trade", "{count} trades");
  let subtitle = `${count} · ${t("Combined view")}`;
  if (activeAccountId !== "all") subtitle = `${count} · ${activeAccount ? activeAccount.name : t("Account")} · ${activeAccount ? accountOverviewLabel(activeAccount, t) : t("No account selected")}`;
  const finish = () => { dashboard.cancel(); setEditing(false); };
  return <div className="space-y-5 sm:space-y-6 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <SectionHeader title={t("Account overview")} sub={subtitle} />
    <DashboardToolbar editing={editing} dirty={dashboard.dirty} saving={dashboard.saving} error={dashboard.error} conflict={dashboard.conflict}
      onEdit={() => setEditing(true)} onReset={dashboard.reset} onCancel={finish} onReload={dashboard.reload}
      onSave={async () => { if (await dashboard.save()) setEditing(false); }} />
    </div>
    <AccountRulesCard key={activeAccount?.id ?? "all"} account={activeAccount} accountId={activeAccountId} trades={visibleTrades} />
    <DashboardGrid layout={dashboard.layout} onChange={dashboard.setLayout} editing={editing && dashboard.ready} />
  </div>;
}
