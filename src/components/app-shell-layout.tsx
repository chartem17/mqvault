"use client";

import { type ReactNode } from "react";
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
} from "lucide-react";
import type { TabId } from "@/app/page";
import AccountSwitcher from "@/components/account-switcher";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Огляд", icon: LayoutDashboard },
  { id: "journal", label: "Журнал", icon: BookOpen },
  { id: "market", label: "Ринок", icon: Globe2 },
  { id: "calendar", label: "Календар", icon: CalendarDays },
  { id: "news", label: "Новини", icon: Newspaper },
  { id: "screenshots", label: "Скріни", icon: Camera },
];

export default function AppShellLayout({
  children,
  activeTab,
  onTabChange,
}: {
  children: ReactNode;
  activeTab: TabId;
  onTabChange: (t: TabId) => void;
}) {
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Лівий сайдбар — єдина навігація між вкладками */}
        <aside className="hidden border-r border-border/70 bg-[#081011] lg:flex lg:flex-col">
          <div className="border-b border-border/70 px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">Trade Vault</div>
                <div className="text-[11px] text-muted-foreground">
                  Multi-account workspace
                </div>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-3 py-4">
            <div className="space-y-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onTabChange(tab.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                      active
                        ? "bg-primary/12 text-primary"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="border-t border-border/70 px-4 py-3">
            <div className="rounded-2xl border border-border/70 bg-card/60 px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Workspace
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Tabs on the left · Accounts on the top-right
              </div>
            </div>
          </div>
        </aside>

        {/* Основна область */}
        <div className="flex min-h-screen min-w-0 flex-col">
          {/* Верхній хедер — без вкладок, тільки account switcher + theme */}
          <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4 px-4 py-3 lg:px-6">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">
                  {TABS.find((t) => t.id === activeTab)?.label ?? "Огляд"}
                </div>
                <div className="mt-0.5 text-sm font-semibold">
                  Trade dashboard
                </div>
              </div>

              <div className="flex items-center gap-2">
                <AccountSwitcher />

                <button
                  type="button"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card/70 text-muted-foreground transition hover:text-foreground"
                  aria-label="Toggle theme"
                >
                  {theme === "dark" ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}