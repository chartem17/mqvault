"use client";

import { useState } from "react";
import { useTrades } from "@/hooks/use-trades";
import { useDashboardLayout } from "@/hooks/use-dashboard-layout";
import { accountOverviewLabel } from "@/lib/account-overview";
import { AccountRulesCard } from "@/components/accounts/account-rules-card";
import { SectionHeader } from "@/components/ui/section-header";
import { DashboardGrid } from "@/components/overview/dashboard-grid";
import { DashboardToolbar } from "@/components/overview/dashboard-toolbar";

export function OverviewTab() {
  const { visibleTrades, activeAccount, activeAccountId } = useTrades();
  const dashboard = useDashboardLayout();
  const [editing, setEditing] = useState(false);
  let subtitle = `${visibleTrades.length} угод · Combined view`;
  if (activeAccountId !== "all") subtitle = `${visibleTrades.length} угод · ${activeAccount ? activeAccount.name : "Account"} · ${activeAccount ? accountOverviewLabel(activeAccount) : "Рахунок не вибрано"}`;
  const finish = () => { dashboard.cancel(); setEditing(false); };
  return <div className="space-y-6 p-6">
    <SectionHeader title="Огляд рахунку" sub={subtitle} />
    <AccountRulesCard key={activeAccount?.id ?? "all"} account={activeAccount} accountId={activeAccountId} trades={visibleTrades} />
    <DashboardToolbar editing={editing} dirty={dashboard.dirty} saving={dashboard.saving} error={dashboard.error} conflict={dashboard.conflict}
      onEdit={() => setEditing(true)} onReset={dashboard.reset} onCancel={finish} onReload={dashboard.reload}
      onSave={async () => { if (await dashboard.save()) setEditing(false); }} />
    <DashboardGrid layout={dashboard.layout} onChange={dashboard.setLayout} editing={editing && dashboard.ready} />
  </div>;
}
