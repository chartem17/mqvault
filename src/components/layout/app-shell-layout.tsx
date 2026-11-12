"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BookOpen, CalendarDays, Globe2, House, LayoutDashboard, ShieldCheck, TrendingUp } from "lucide-react";
import type { TabId } from "@/app/page";
import AccountSwitcher from "@/components/accounts/account-switcher";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { CommandPalette } from "@/components/layout/command-palette";
import { Shortcuts } from "@/components/layout/shortcuts";
import { useI18n } from "@/components/providers/i18n-provider";
import { usePreferences } from "@/components/providers/preferences-provider";
import { DefaultAccount } from "@/components/layout/default-account";
import { UserMenu } from "@/components/layout/user-menu";
import { LanguageToggle } from "@/components/settings/language-toggle";
import { useCurrentUser } from "@/hooks/use-current-user";
import { OWNER_ONLY_TABS } from "@/lib/auth/beta-access";
import { msg } from "@/lib/i18n/core";

/** Phone bottom bar keeps the tabs; profile, settings and sign-out are in the header account menu. */
const ALL_TABS: { id: TabId; label: string; short?: string; icon: React.ElementType }[] = [
  { id: "home", label: msg("Home"), icon: House },
  { id: "overview", label: msg("Overview"), icon: LayoutDashboard },
  { id: "journal", label: msg("Journal"), icon: BookOpen },
  { id: "strategy-control", label: msg("Strategy control"), short: msg("Strategy"), icon: ShieldCheck },
  { id: "market", label: msg("Market"), icon: Globe2 },
  { id: "calendar", label: msg("Calendar"), icon: CalendarDays },
];

export default function AppShellLayout({ children, activeTab, setActiveTab }: { children: ReactNode; activeTab: TabId; setActiveTab: (tab: TabId) => void }) {
  const { t } = useI18n();
  // Closed beta: Market and Calendar stay with the installation owner (data licensed for private use).
  const owner = useCurrentUser()?.isOwner === true;
  const TABS = ALL_TABS.filter(tab => owner || !OWNER_ONLY_TABS.includes(tab.id));
  const [search, setSearch] = useState(false);
  // Screens format numbers through shared helpers; a new format or privacy mode re-renders them all at once.
  const { preferences } = usePreferences();
  const displayKey = `${preferences.numberFormat}:${preferences.privacy ? 1 : 0}`;
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearch(value => !value); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen text-foreground">
      <DefaultAccount />
      <div key={displayKey} className="flex min-h-screen">
        <AppSidebar activeTab={activeTab} setActiveTab={setActiveTab} onSearch={() => setSearch(true)} />
        <main className="min-w-0 flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
          <div className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border bg-background/85 px-3 py-2.5 backdrop-blur sm:gap-4 sm:px-6 sm:py-4 md:border-transparent md:bg-transparent md:backdrop-blur-none xl:px-8">
            <div className="flex items-center gap-3 md:hidden">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10"><TrendingUp className="h-4.5 w-4.5 text-primary" aria-hidden="true" /></div>
              <div className="hidden min-w-0 sm:block"><div className="truncate text-base font-semibold tracking-tight">Trade Vault</div></div>
            </div>
            <div className="hidden md:block" />
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-none sm:gap-3">
              <AccountSwitcher />
              {/* Phone: the sidebar is hidden, so the account menu leads to the profile, settings and sign-out. */}
              <div className="flex items-center gap-2 md:hidden"><LanguageToggle /><UserMenu /></div>
            </div>
          </div>
          <div key={activeTab} className="page-enter px-3 py-4 sm:px-6 sm:py-5 xl:px-8 xl:py-6">{children}</div>
        </main>
      </div>
      <Shortcuts />
      <CommandPalette open={search} onClose={() => setSearch(false)} setActiveTab={setActiveTab} />
      <nav aria-label={t("Main navigation")} style={{ gridTemplateColumns: `repeat(${TABS.length}, minmax(0, 1fr))` }} className="fixed inset-x-0 bottom-0 z-40 grid border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
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
