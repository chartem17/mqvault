import { BookOpen, CalendarDays, Globe2, House, LayoutDashboard, MonitorSmartphone, Settings, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import type { TabId } from "@/app/page";
import { msg } from "@/lib/i18n/core";
import { OWNER_ONLY_TABS } from "@/lib/auth/beta-access";

export type NavTarget = { kind: "tab"; tab: TabId } | { kind: "href"; href: string };
export type NavPage = { key: string; label: string; short?: string; icon: LucideIcon; section: "main" | "markets" | "workspace"; target: NavTarget };

/** Every destination the sidebar and the Ctrl/⌘K search know about. Labels are English source text for t(). */
export const NAV_PAGES: NavPage[] = [
  { key: "home", label: msg("Home"), icon: House, section: "main", target: { kind: "tab", tab: "home" } },
  { key: "overview", label: msg("Overview"), icon: LayoutDashboard, section: "main", target: { kind: "tab", tab: "overview" } },
  { key: "journal", label: msg("Journal"), icon: BookOpen, section: "main", target: { kind: "tab", tab: "journal" } },
  { key: "strategy-control", label: msg("Strategy control"), short: msg("Strategy"), icon: ShieldCheck, section: "main", target: { kind: "tab", tab: "strategy-control" } },
  { key: "market", label: msg("Market"), icon: Globe2, section: "markets", target: { kind: "tab", tab: "market" } },
  { key: "calendar", label: msg("Calendar"), icon: CalendarDays, section: "markets", target: { kind: "tab", tab: "calendar" } },
  { key: "bridge", label: msg("MT5 Bridge"), icon: MonitorSmartphone, section: "workspace", target: { kind: "href", href: "/bridge/connect" } },
  { key: "settings", label: msg("Settings"), icon: Settings, section: "workspace", target: { kind: "href", href: "/settings" } },
  { key: "profile", label: msg("Profile"), icon: UserRound, section: "workspace", target: { kind: "href", href: "/profile" } },
];

export const SECTION_LABEL: Record<NavPage["section"], string> = { main: msg("Main"), markets: msg("Markets"), workspace: msg("Workspace") };

/** Closed beta (ADR 0017): Market and Calendar stay with the installation owner. */
export function visiblePages(isOwner: boolean): NavPage[] {
  return NAV_PAGES.filter(page => isOwner || page.target.kind !== "tab" || !OWNER_ONLY_TABS.includes(page.target.tab));
}
