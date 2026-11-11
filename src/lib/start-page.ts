import { msg } from "./i18n/core";

/** Settings → Start page: which tab opens when the site is entered without ?tab=. Stored per device. */
export const START_TAB_KEY = "mq_start_tab";
export const START_TABS = [
  { id: "home", label: msg("Home"), ownerOnly: false },
  { id: "overview", label: msg("Overview"), ownerOnly: false },
  { id: "journal", label: msg("Journal"), ownerOnly: false },
  { id: "strategy-control", label: msg("Strategy control"), ownerOnly: false },
  { id: "calendar", label: msg("Calendar"), ownerOnly: true },
] as const;

export function readStartTab(): string {
  try {
    const value = localStorage.getItem(START_TAB_KEY);
    return START_TABS.some(tab => tab.id === value) ? value as string : "home";
  } catch { return "home"; }
}
