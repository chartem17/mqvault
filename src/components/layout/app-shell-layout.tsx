"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { House, LayoutDashboard, BookOpen, Globe2, CalendarDays, TrendingUp, Sun, Moon, ShieldCheck, MonitorSmartphone } from "lucide-react";
import type { TabId } from "@/app/page";
import AccountSwitcher from "@/components/accounts/account-switcher";
import { Button } from "@/components/ui/primitives";
import { NavigationButton } from "@/components/layout/navigation-button";
import { TimezoneControl } from "@/components/settings/timezone-control";
import { LanguageToggle } from "@/components/settings/language-toggle";
import { useI18n } from "@/components/providers/i18n-provider";
import { msg } from "@/lib/i18n/core";

const TABS: { id: TabId; label: string; short?: string; icon: React.ElementType }[] = [
  { id: "home", label: msg("Home"), icon: House },
  { id: "overview", label: msg("Overview"), icon: LayoutDashboard },
  { id: "journal", label: msg("Journal"), icon: BookOpen },
  { id: "strategy-control", label: msg("Strategy control"), short: msg("Strategy"), icon: ShieldCheck },
  { id: "market", label: msg("Market"), icon: Globe2 },
  { id: "calendar", label: msg("Calendar"), icon: CalendarDays },
];

export default function AppShellLayout({ children, activeTab, setActiveTab }: { children: ReactNode; activeTab: TabId; setActiveTab: (tab: TabId) => void }) {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const light = mounted && resolvedTheme === "light";
  const themeLabel = light ? t("Dark theme") : t("Light theme");
  const brand = <div className="flex items-center gap-3">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10"><TrendingUp className="h-4.5 w-4.5 text-primary" /></div>
    <div className="hidden min-w-0 sm:block md:hidden lg:block"><div className="truncate text-base font-semibold tracking-tight text-foreground">Trade Vault</div><div className="truncate text-[11px] text-muted-foreground">{t("Execution workspace")}</div></div>
  </div>;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        {/* md: icon rail, lg+: full sidebar; phones use the bottom tab bar instead */}
        <aside className="app-sidebar sticky top-0 hidden h-screen w-[72px] shrink-0 flex-col border-r border-border bg-card/40 backdrop-blur md:flex lg:w-[248px]">
          <div className="flex justify-center border-b border-border px-4 py-4 lg:justify-start">{brand}</div>
          <nav aria-label={t("Main navigation")} className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return <NavigationButton key={tab.id} active={activeTab === tab.id} title={t(tab.label)} onClick={() => setActiveTab(tab.id)} icon={<Icon aria-hidden="true" className="h-4 w-4 shrink-0" />} className="nav-rail-button">{t(tab.label)}</NavigationButton>;
            })}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
          <div className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border bg-background/85 px-3 py-2.5 backdrop-blur sm:gap-4 sm:px-6 sm:py-4 xl:px-8">
            <div className="hidden sm:block md:hidden">{brand}</div>
            <div className="hidden md:block" />
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-none sm:gap-3">
              <AccountSwitcher />
              <TimezoneControl />
              <LanguageToggle />
              <Link href="/bridge/connect" aria-label={t("MT5 Bridge: connected computers")} title={t("MT5 Bridge: connected computers")} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-2.5 text-sm font-medium text-secondary-foreground transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 sm:px-4">
                <MonitorSmartphone aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span className="hidden xl:inline">{t("MT5 Bridge")}</span>
              </Link>
              <Button variant="secondary" className="px-2.5 sm:px-4" aria-label={themeLabel} title={themeLabel} disabled={!mounted} onClick={() => mounted && setTheme(resolvedTheme === "light" ? "dark" : "light")}>
                {light ? <Moon aria-hidden="true" className="h-4 w-4 shrink-0" /> : <Sun aria-hidden="true" className="h-4 w-4 shrink-0" />}
                <span className="hidden xl:inline">{themeLabel}</span>
              </Button>
            </div>
          </div>
          <div className="px-3 py-4 sm:px-6 sm:py-5 xl:px-8 xl:py-6">{children}</div>
        </main>
      </div>
      <nav aria-label={t("Main navigation")} className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {TABS.map((tab) => {
          const Icon = tab.icon, active = activeTab === tab.id;
          return <button key={tab.id} type="button" aria-current={active ? "page" : undefined} onClick={() => setActiveTab(tab.id)} className={`flex min-w-0 flex-col items-center gap-1 px-0.5 pb-2 pt-2.5 text-[10px] leading-tight focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${active ? "text-primary" : "text-muted-foreground"}`}>
            <Icon aria-hidden="true" className="h-5 w-5 shrink-0" /><span className="w-full truncate text-center">{t(tab.short ?? tab.label)}</span>
          </button>;
        })}
      </nav>
    </div>
  );
}
