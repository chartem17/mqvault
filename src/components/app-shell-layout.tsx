"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  BookOpen,
  Globe2,
  CalendarDays,
  Newspaper,
  Camera,
  TrendingUp,
  Sun,
  Moon,
  ShieldCheck,
} from "lucide-react";
import type { TabId } from "@/app/page";
import AccountSwitcher from "@/components/account-switcher";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Огляд", icon: LayoutDashboard },
  { id: "journal", label: "Журнал", icon: BookOpen },
  { id: "strategy-control", label: "Контроль стратегії", icon: ShieldCheck },
  { id: "market", label: "Ринок", icon: Globe2 },
  { id: "calendar", label: "Календар", icon: CalendarDays },
  { id: "news", label: "Новини", icon: Newspaper },
  { id: "screenshots", label: "Скріни", icon: Camera },
];

export default function AppShellLayout({
  children,
  activeTab,
  setActiveTab,
}: {
  children: ReactNode;
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="flex w-[248px] shrink-0 flex-col border-r border-border bg-card/40 backdrop-blur">
          <div className="border-b border-border px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10">
                <TrendingUp className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <div className="text-base font-semibold tracking-tight text-foreground">
                  Trade Vault
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Execution workspace
                </div>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-1 px-2 py-3">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                    isActive
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4 xl:px-8">
            <div />
            <div className="flex items-center gap-3">
              <AccountSwitcher />
              <button
                type="button"
                onClick={() =>
                  mounted &&
                  setTheme(resolvedTheme === "light" ? "dark" : "light")
                }
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                {mounted && resolvedTheme === "light" ? (
                  <Moon className="h-4 w-4 shrink-0" />
                ) : (
                  <Sun className="h-4 w-4 shrink-0" />
                )}
                <span className="hidden sm:inline">
                  {mounted && resolvedTheme === "light"
                    ? "Темна тема"
                    : "Світла тема"}
                </span>
              </button>
            </div>
          </div>

          <div className="px-6 py-5 xl:px-8 xl:py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
