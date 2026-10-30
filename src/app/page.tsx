"use client";

import { Suspense, useMemo, type Dispatch, type SetStateAction } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShellLayout from "@/components/app-shell-layout";
import { OverviewTab } from "@/components/tabs/overview-tab";
import { JournalTab } from "@/components/tabs/journal-tab";
import { MarketTab } from "@/components/tabs/market-tab";
import { CalendarTab } from "@/components/tabs/calendar-tab";
import { NewsTab } from "@/components/tabs/news-tab";
import { ScreenshotsTab } from "@/components/tabs/screenshots-tab";
import { StrategyControlTab } from "@/components/tabs/strategy-control-tab";
import { parseJournalFocus } from "@/lib/journal-focus";

const TABS = ["overview", "journal", "strategy-control", "market", "calendar", "news", "screenshots"] as const;
export type TabId = typeof TABS[number];
function HomeContent() {
  const router = useRouter();
  const search = useSearchParams();
  const focus = useMemo(() => parseJournalFocus(search), [search]);
  const activeTab: TabId = focus.kind !== "none" ? "journal" : TABS.find(tab => tab === search.get("tab")) ?? "overview";
  const setActiveTab: Dispatch<SetStateAction<TabId>> = value => {
    const next = typeof value === "function" ? value(activeTab) : value;
    if (next === activeTab && focus.kind === "none") return;
    const params = new URLSearchParams(search.toString());
    params.delete("focusTradeIds"); params.set("tab", next);
    router.push(`/?${params.toString()}`, { scroll: false });
  };
  function clearFocus() {
    const params = new URLSearchParams(search.toString());
    params.delete("focusTradeIds"); params.set("tab", "journal");
    router.replace(`/?${params.toString()}`, { scroll: false });
  }
  function renderTab() {
    switch (activeTab) {
      case "overview": return <OverviewTab />;
      case "journal": return <JournalTab key={focus.kind === "ids" ? `ids:${focus.ids.join(",")}` : focus.kind} focus={focus} onClearFocus={clearFocus} />;
      case "strategy-control": return <StrategyControlTab />;
      case "market": return <MarketTab />;
      case "calendar": return <CalendarTab />;
      case "news": return <NewsTab />;
      case "screenshots": return <ScreenshotsTab />;
    }
  }
  return <AppShellLayout activeTab={activeTab} setActiveTab={setActiveTab}>{renderTab()}</AppShellLayout>;
}
export default function Home() {
  return <Suspense fallback={<div role="status" className="p-6 text-sm text-muted-foreground">Завантаження робочого простору…</div>}><HomeContent /></Suspense>;
}
