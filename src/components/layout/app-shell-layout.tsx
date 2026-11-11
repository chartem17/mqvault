"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { BookOpen, CalendarDays, Globe2, House, LayoutDashboard, ShieldCheck, TrendingUp } from "lucide-react";
import type { TabId } from "@/app/page";
import AccountSwitcher from "@/components/accounts/account-switcher";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { CommandPalette } from "@/components/layout/command-palette";
import { useI18n } from "@/components/providers/i18n-provider";
import { useProfile, avatarInitial } from "@/components/providers/profile-provider";
import { msg } from "@/lib/i18n/core";

/** Phone bottom bar keeps the six tabs; profile and settings are reached through the header avatar. */
const TABS: { id: TabId; label: string; short?: string; icon: React.ElementType }[] = [
  { id: "home", label: msg("Home"), icon: House },
  { id: "overview", label: msg("Overview"), icon: LayoutDashboard },
  { id: "journal", label: msg("Journal"), icon: BookOpen },
  { id: "strategy-control", label: msg("Strategy control"), short: msg("Strategy"), icon: ShieldCheck },
  { id: "market", label: msg("Market"), icon: Globe2 },
  { id: "calendar", label: msg("Calendar"), icon: CalendarDays },
];

export default function AppShellLayout({ children, activeTab, setActiveTab }: { children: ReactNode; activeTab: TabId; setActiveTab: (tab: TabId) => void }) {
  const { t } = useI18n();
  const { profile } = useProfile();
  const [search, setSearch] = useState(false);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearch(value => !value); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
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
              {/* Phone: the sidebar is hidden, so the avatar is the way to the profile and settings. */}
              <Link href="/profile" aria-label={t("Profile")} title={t("Profile")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-secondary md:hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {profile?.avatar_url ? <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full object-cover" /> : <span className="text-sm font-semibold text-primary">{avatarInitial(profile)}</span>}
              </Link>
            </div>
          </div>
          <div className="px-3 py-4 sm:px-6 sm:py-5 xl:px-8 xl:py-6">{children}</div>
        </main>
      </div>
      <CommandPalette open={search} onClose={() => setSearch(false)} setActiveTab={setActiveTab} />
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
