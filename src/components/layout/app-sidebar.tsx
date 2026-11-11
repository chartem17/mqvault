"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ChevronsLeft, ChevronsRight, Languages, Moon, Search, Sun, TrendingUp } from "lucide-react";
import { LOCALE_LABEL } from "@/lib/i18n/core";
import type { TabId } from "@/app/page";
import { SECTION_LABEL, visiblePages, type NavPage } from "./nav-pages";
import { useTrades } from "@/hooks/use-trades";
import { useI18n } from "@/components/providers/i18n-provider";
import { useProfile, avatarInitial } from "@/components/providers/profile-provider";
import { buildAccountOverview, accountOverviewLabel } from "@/lib/accounts/account-overview";
import { needsReview } from "@/lib/journal/trade-review";
import { fmt } from "@/lib/journal/utils-trade";
import { usePreferences } from "@/components/providers/preferences-provider";
import "./app-sidebar.css";

const COLLAPSE_KEY = "mq_sidebar_collapsed";

function Avatar({ url, initial, size }: { url: string | null; initial: string; size: string }) {
  return <span className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-primary ${size}`}>
    {/* Provider avatars come from varying hosts; a plain img avoids next/image host config. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {url ? <img src={url} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : <span className="text-sm font-semibold">{initial}</span>}
  </span>;
}

export function AppSidebar({ activeTab, setActiveTab, onSearch }: { activeTab: TabId; setActiveTab: (tab: TabId) => void; onSearch: () => void }) {
  const { t, locale, setLocale } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();
  const { profile, loading: profileLoading } = useProfile();
  const pages = visiblePages(profile?.plan === "owner");
  const { trades, activeAccount } = useTrades();
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [bridgePending, setBridgePending] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const items = useRef(new Map<string, HTMLElement>());
  const [pill, setPill] = useState<{ top: number; height: number } | null>(null);
  const [metaKey, setMetaKey] = useState("Ctrl");

  useEffect(() => {
    setMounted(true);
    try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1"); } catch { /* storage may be blocked */ }
    if (/Mac|iP(hone|ad|od)/.test(navigator.platform)) setMetaKey("⌘");
  }, []);
  const toggleCollapsed = () => setCollapsed(value => {
    try { localStorage.setItem(COLLAPSE_KEY, value ? "0" : "1"); } catch { /* ignore */ }
    return !value;
  });
  useEffect(() => {
    // One cheap read: a gold dot on MT5 Bridge while a new MT5 account waits for the owner's answer.
    fetch("/api/bridge/accounts", { credentials: "same-origin" })
      .then(response => response.ok ? response.json() : null)
      .then((data: { accounts?: unknown[] } | null) => setBridgePending(Boolean(data?.accounts?.length)))
      .catch(() => { /* offline */ });
  }, []);

  const reviewCount = useMemo(() => trades.filter(trade => trade.closed_at && needsReview(trade)).length, [trades]);
  const { preferences } = usePreferences();
  const badges: Record<string, number> = { journal: preferences.reviewReminder ? reviewCount : 0 };
  const overview = activeAccount ? buildAccountOverview(activeAccount, trades) : null;
  const activeKey = pages.find(page => page.target.kind === "tab" && page.target.tab === activeTab)?.key ?? null;

  /** The light pill glides to the hovered item, resting on the active one. */
  const movePill = useCallback(() => {
    const nav = navRef.current;
    const key = hoverKey ?? activeKey;
    const element = key ? items.current.get(key) : null;
    if (!nav || !element) { setPill(null); return; }
    const navRect = nav.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    setPill({ top: rect.top - navRect.top + nav.scrollTop, height: rect.height });
  }, [hoverKey, activeKey]);
  useLayoutEffect(() => {
    movePill();
    const id = window.setTimeout(movePill, 480); // once more after the width spring settles
    return () => window.clearTimeout(id);
  }, [movePill, collapsed]);

  const register = (key: string) => (element: HTMLElement | null) => { if (element) items.current.set(key, element); else items.current.delete(key); };
  const itemProps = (key: string) => ({ ref: register(key), onMouseEnter: () => setHoverKey(key), onMouseLeave: () => setHoverKey(current => (current === key ? null : current)), onFocus: () => setHoverKey(key), onBlur: () => setHoverKey(current => (current === key ? null : current)) });

  function renderItem(page: NavPage) {
    const Icon = page.icon;
    const badge = badges[page.key];
    const dot = page.key === "bridge" && bridgePending;
    const label = <>
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="sb-label sb-hide min-w-0 flex-1 truncate">{t(page.label)}</span>
      {badge ? <span className="sb-badge sb-hide">{badge > 99 ? "99+" : badge}</span> : null}
      {dot ? <span className="sb-dot sb-hide" aria-hidden="true" /> : null}
      {collapsed && <span className="sb-tip" aria-hidden="true">{t(page.label)}{badge ? <span className="sb-badge">{badge > 99 ? "99+" : badge}</span> : null}{dot ? <span className="sb-dot" /> : null}</span>}
    </>;
    if (page.target.kind === "href") {
      return <div key={page.key} className="relative">
        <Link href={page.target.href} {...itemProps(page.key)} className="sb-item">{label}</Link>
      </div>;
    }
    const tab = page.target.tab;
    return <div key={page.key} className="relative">
      <button type="button" {...itemProps(page.key)} className="sb-item" aria-current={activeTab === tab ? "page" : undefined} data-active={activeTab === tab || undefined} onClick={() => setActiveTab(tab)}>{label}</button>
    </div>;
  }

  const sections: NavPage["section"][] = ["main", "markets", "workspace"];
  const light = mounted && resolvedTheme === "light";
  const themeLabel = light ? t("Dark theme") : t("Light theme");
  const languageLabel = t("Switch language to {language}", { language: LOCALE_LABEL[locale === "en" ? "uk" : "en"] });

  return <div className="sb-wrap hidden md:block" data-open={!collapsed} style={{ "--sb-width": collapsed ? "4.75rem" : "17.5rem" } as React.CSSProperties}>
    <aside className="sb-panel" aria-label={t("Main navigation")}>
      <div className={`flex items-center gap-2.5 px-3 pb-2 pt-3 ${collapsed ? "flex-col" : ""}`}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10"><TrendingUp className="h-4.5 w-4.5 text-primary" aria-hidden="true" /></div>
        <div className="sb-label sb-hide min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold tracking-tight">Trade Vault</div>
          <div className="truncate text-[11px] text-muted-foreground">{t("Execution workspace")}</div>
        </div>
        <button type="button" onClick={toggleCollapsed} aria-label={collapsed ? t("Expand sidebar") : t("Collapse sidebar")} title={collapsed ? t("Expand sidebar") : t("Collapse sidebar")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          {collapsed ? <ChevronsRight className="h-4 w-4" aria-hidden="true" /> : <ChevronsLeft className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>

      {!collapsed && <div className="sb-hide px-3 pb-1">
        <button type="button" onClick={onSearch}
          className="flex min-h-9 w-full items-center gap-2.5 rounded-xl border border-border bg-background/50 px-3 text-sm text-muted-foreground transition-colors hover:border-ring/50 hover:text-foreground">
          <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="sb-label flex-1 truncate text-left">{t("Search pages…")}</span>
          <kbd className="sb-label shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[10px]">{metaKey} K</kbd>
        </button>
        {activeAccount && overview && <div className="mt-2 rounded-xl border border-border bg-background/40 p-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: activeAccount.color }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{activeAccount.name}</span>
            {overview.netPnl !== null && <span className={`shrink-0 text-xs font-medium ${overview.netPnl >= 0 ? "text-green" : "text-red"}`}>{overview.netPnl >= 0 ? "+" : ""}{fmt.money(overview.netPnl)}</span>}
          </div>
          <div className="mt-1 truncate text-[11px] text-muted-foreground">{accountOverviewLabel(activeAccount, t)}</div>
          {overview.isProp && overview.progressPercent !== null && <div className="mt-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-[rgb(var(--ink)/0.1)]">
              <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${overview.progressPercent}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>{t("Target progress")}</span><span>{Math.round(overview.progressPercent)}%</span>
            </div>
          </div>}
        </div>}
      </div>}

      <nav ref={navRef} className="sb-nav" aria-label={t("Main navigation")}>
        <span className="sb-pill" aria-hidden="true" style={pill ? { transform: `translateY(${pill.top}px)`, height: pill.height, opacity: 1 } : undefined} />
        {sections.filter(section => pages.some(page => page.section === section)).map(section => <div key={section} className={section === "main" ? "" : "mt-2"}>
          {collapsed
            ? section !== "main" && <div className="mx-auto my-2 h-px w-7 bg-border" aria-hidden="true" />
            : <div className="sb-label px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">{t(SECTION_LABEL[section])}</div>}
          <div className="space-y-0.5">{pages.filter(page => page.section === section && page.key !== "profile").map(renderItem)}</div>
        </div>)}
      </nav>

      <div className="border-t border-[rgb(var(--ink)/0.08)] px-3 py-2.5">
        <div className={`flex gap-1 ${collapsed ? "flex-col" : "items-center"}`}>
          <div className="relative min-w-0 flex-1">
            <button type="button" disabled={!mounted} onClick={() => mounted && setTheme(light ? "dark" : "light")} aria-label={themeLabel}
              className={`sb-item ${collapsed ? "" : "!min-h-9"}`}>
              {light ? <Moon className="h-4 w-4 shrink-0" aria-hidden="true" /> : <Sun className="h-4 w-4 shrink-0" aria-hidden="true" />}
              <span className="sb-label sb-hide min-w-0 flex-1 truncate text-left">{themeLabel}</span>
              {collapsed && <span className="sb-tip" aria-hidden="true">{themeLabel}</span>}
            </button>
          </div>
          <div className="relative">
            <button type="button" onClick={() => setLocale(locale === "en" ? "uk" : "en")} aria-label={languageLabel}
              className={`sb-item ${collapsed ? "" : "!min-h-9 !w-auto !px-2.5"}`}>
              <Languages className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="text-xs font-semibold uppercase tracking-wide">{locale === "en" ? "EN" : "UA"}</span>
              {collapsed && <span className="sb-tip" aria-hidden="true">{languageLabel}</span>}
            </button>
          </div>
        </div>
        <div className="relative mt-1">
          <Link href="/profile" className={`sb-item ${collapsed ? "" : "!px-2"}`} aria-label={t("Profile")}>
            <span className="relative shrink-0">
              <Avatar url={profile?.avatar_url ?? null} initial={avatarInitial(profile)} size="h-8 w-8" />
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-green" aria-hidden="true" />
            </span>
            <span className="sb-label sb-hide min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">{profile?.display_name || (profileLoading ? "…" : t("Your profile"))}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{profile?.email ?? ""}</span>
            </span>
            {collapsed && <span className="sb-tip" aria-hidden="true">{profile?.display_name || t("Your profile")}</span>}
          </Link>
        </div>
      </div>
    </aside>
  </div>;
}
