"use client";
import { useState } from "react";
import AppShellLayout from "@/components/app-shell-layout";
import { OverviewTab } from "@/components/tabs/overview-tab";
import { JournalTab } from "@/components/tabs/journal-tab";
import { MarketTab } from "@/components/tabs/market-tab";
import { CalendarTab } from "@/components/tabs/calendar-tab";
import { NewsTab } from "@/components/tabs/news-tab";
import { ScreenshotsTab } from "@/components/tabs/screenshots-tab";

export type TabId =
  | "overview"
  | "journal"
  | "market"
  | "calendar"
  | "news"
  | "screenshots";

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const renderTab = () => {
    switch (activeTab) {
      case "overview":
        return <OverviewTab />;
      case "journal":
        return <JournalTab />;
      case "market":
        return <MarketTab />;
      case "calendar":
        return <CalendarTab />;
      case "news":
        return <NewsTab />;
      case "screenshots":
        return <ScreenshotsTab />;
    }
  };

  return (
    <AppShellLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderTab()}
    </AppShellLayout>
  );
}
