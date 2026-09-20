"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { LayoutDashboard, BookOpen, Globe2, CalendarDays, Newspaper, Camera, TrendingUp, Sun, Moon } from "lucide-react";
import type { TabId } from "@/app/page";
import AccountSwitcher from "@/components/account-switcher";
import LightRays from "@/components/ui/light-rays";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Огляд", icon: LayoutDashboard },
  { id: "journal", label: "Журнал", icon: BookOpen },
  { id: "market", label: "Ринок", icon: Globe2 },
  { id: "calendar", label: "Календар", icon: CalendarDays },
  { id: "news", label: "Новини", icon: Newspaper },
  { id: "screenshots", label: "Скріни", icon: Camera },
];

export default function AppShellLayout({ children, activeTab, onTabChange }: { children: ReactNode; activeTab: TabId; onTabChange: (tab: TabId) => void }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <LightRays />
      <div className="relative z-10 flex min-h-screen">
        <aside className="relative z-20 flex w-[240px] shrink-0 flex-col border-r border-white/10 bg-[#081011]/92 backdrop-blur-md">
          <div className="border-b border-border/70 px-5 py-4"><div className="flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary"><TrendingUp className="h-4 w-4" /></div><div><div className="text-sm font-semibold">Trade Vault</div><div className="text-[11px] text-muted-foreground">Multi-account workspace</div></div></div></div>
          <nav className="flex-1 px-3 py-4"><div className="space-y-1">{TABS.map((tab) => { const Icon=tab.icon; return <button key={tab.id} type="button" onClick={()=>onTabChange(tab.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${activeTab===tab.id ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"}`}><Icon className="h-4 w-4"/><span>{tab.label}</span></button>; })}</div></nav>
          <div className="border-t border-border/70 px-4 py-3"><div className="rounded-2xl border border-border/70 bg-card/60 px-3 py-3"><div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Workspace</div><div className="mt-1 text-xs text-muted-foreground">Tabs on the left · Accounts on the top-right</div></div></div>
        </aside>
        <div className="relative z-10 flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="relative z-30 flex h-[72px] shrink-0 items-center justify-end border-b border-white/[0.06] bg-transparent px-6"><div className="flex items-center gap-2"><AccountSwitcher/><button type="button" onClick={()=>setTheme(theme==="dark"?"light":"dark")} className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-muted-foreground backdrop-blur-md transition hover:bg-white/[0.06] hover:text-foreground" aria-label="Toggle theme">{mounted ? (theme==="dark"?<Sun className="h-4 w-4"/>:<Moon className="h-4 w-4"/>) : <span className="h-4 w-4" aria-hidden="true"/>}</button></div></header>
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
