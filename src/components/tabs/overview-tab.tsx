"use client";

import { useTrades } from "@/hooks/use-trades";
import { accountOverviewLabel } from "@/lib/account-overview";
import { AccountRulesCard } from "@/components/accounts/account-rules-card";
import { SectionHeader } from "@/components/ui/section-header";
import { GRID_GAP, ROW_HEIGHT, defaultItems } from "@/lib/dashboard-widgets";
import { WIDGET_COMPONENTS } from "@/components/overview/widget-registry";

export function OverviewTab() {
  const { visibleTrades, activeAccount, activeAccountId } = useTrades();
  let subtitle = `${visibleTrades.length} угод · Combined view`;
  if (activeAccountId !== "all") subtitle = `${visibleTrades.length} угод · ${activeAccount ? activeAccount.name : "Account"} · ${activeAccount ? accountOverviewLabel(activeAccount) : "Рахунок не вибрано"}`;
  return <div className="space-y-6 p-6">
    <SectionHeader title="Огляд рахунку" sub={subtitle} />
    <AccountRulesCard key={activeAccount?.id ?? "all"} account={activeAccount} accountId={activeAccountId} trades={visibleTrades} />
    <div className="grid" style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gridAutoRows: ROW_HEIGHT, gap: GRID_GAP }}>
      {defaultItems().map(item => { const Widget = WIDGET_COMPONENTS[item.key]; return <div key={item.key} className="min-h-0 min-w-0" style={{ gridColumn: `${item.x + 1} / span ${item.w}`, gridRow: `${item.y + 1} / span ${item.h}` }}><Widget /></div>; })}
    </div>
  </div>;
}
