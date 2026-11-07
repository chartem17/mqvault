"use client";

import { Suspense, useMemo, type Dispatch, type SetStateAction } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShellLayout from "@/components/layout/app-shell-layout";
import { HomeTab } from "@/components/tabs/home-tab";
import { OverviewTab } from "@/components/tabs/overview-tab";
import { JournalTab } from "@/components/tabs/journal-tab";
import { MarketTab } from "@/components/tabs/market-tab";
import { CalendarTab } from "@/components/tabs/calendar-tab";
import { StrategyControlTab } from "@/components/tabs/strategy-control-tab";
import { parseJournalFocus } from "@/lib/journal/journal-focus";
import { useI18n } from "@/components/providers/i18n-provider";

const TABS = ["home", "overview", "journal", "strategy-control", "market", "calendar"] as const;
export type TabId = typeof TABS[number];
function HomeContent() {
  const router = useRouter();
  const search = useSearchParams();
  const focus = useMemo(() => parseJournalFocus(search), [search]);
  const activeTab: TabId = focus.kind !== "none" ? "journal" : TABS.find(tab => tab === search.get("tab")) ?? "home";
  const setActiveTab: Dispatch<SetStateAction<TabId>> = value => {
    const next = typeof value === "function" ? value(activeTab) : value;
    if (next === activeTab && focus.kind === "none") return;
    const params = new URLSearchParams(search.toString());
    params.delete("focusTradeIds"); params.delete("review"); params.delete("gallery"); params.set("tab", next);
    router.push(`/?${params.toString()}`, { scroll: false });
  };
  function clearFocus() {
    const params = new URLSearchParams(search.toString());
    params.delete("focusTradeIds"); params.set("tab", "journal");
    router.replace(`/?${params.toString()}`, { scroll: false });
  }
  const review = activeTab === "journal" && search.get("review") === "1";
  function setReview(open: boolean) {
    const params = new URLSearchParams(search.toString());
    params.set("tab", "journal");
    params.delete("gallery");
    if (open) params.set("review", "1"); else params.delete("review");
    router.push(`/?${params.toString()}`, { scroll: false });
  }
  const gallery = activeTab === "journal" && !review && search.get("gallery") === "1";
  function setGallery(open: boolean) {
    const params = new URLSearchParams(search.toString());
    params.set("tab", "journal"); params.delete("review");
    if (open) params.set("gallery", "1"); else params.delete("gallery");
    router.push(`/?${params.toString()}`, { scroll: false });
  }
  function renderTab() {
    switch (activeTab) {
      case "home": return <HomeTab />;
      case "overview": return <OverviewTab />;
      case "journal": return <JournalTab key={focus.kind === "ids" ? `ids:${focus.ids.join(",")}` : focus.kind} focus={focus} onClearFocus={clearFocus} review={review} onReviewChange={setReview} gallery={gallery} onGalleryChange={setGallery} />;
      case "strategy-control": return <StrategyControlTab />;
      case "market": return <MarketTab />;
      case "calendar": return <CalendarTab />;
    }
  }
  return <AppShellLayout activeTab={activeTab} setActiveTab={setActiveTab}>{renderTab()}</AppShellLayout>;
}
export default function Home() {
  const { t } = useI18n();
  return <Suspense fallback={<div role="status" className="p-6 text-sm text-muted-foreground">{t("Loading workspace…")}</div>}><HomeContent /></Suspense>;
}
