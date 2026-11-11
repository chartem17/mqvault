import { BookOpen, CalendarDays, Globe2, House, LayoutDashboard, MonitorSmartphone, Settings, ShieldCheck, UserRound, Wallet2, type LucideIcon } from "lucide-react";
import type { TabId } from "@/app/page";
import { msg } from "@/lib/i18n/core";

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
  { key: "accounts", label: msg("Accounts"), icon: Wallet2, section: "workspace", target: { kind: "tab", tab: "home" } }, // target unused: expands the account list
  { key: "bridge", label: msg("MT5 Bridge"), icon: MonitorSmartphone, section: "workspace", target: { kind: "href", href: "/bridge/connect" } },
  { key: "settings", label: msg("Settings"), icon: Settings, section: "workspace", target: { kind: "href", href: "/settings" } },
  { key: "profile", label: msg("Profile"), icon: UserRound, section: "workspace", target: { kind: "href", href: "/profile" } },
];

export const SECTION_LABEL: Record<NavPage["section"], string> = { main: msg("Main"), markets: msg("Markets"), workspace: msg("Workspace") };
