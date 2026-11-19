/**
 * Workspace sections and their own addresses (`/overview`, `/journal`, …). Pure: no React, no Next.js.
 * Before 2026-11 every section lived on `/` with `?tab=`; `legacyTabDestination` turns those old links
 * (bookmarks, shared evidence links) into the new address so nothing a user saved breaks.
 */

export const WORKSPACE_TABS = ["home", "overview", "journal", "strategy-control", "market", "calendar"] as const;
export type TabId = typeof WORKSPACE_TABS[number];

export function isTabId(value: unknown): value is TabId {
  return typeof value === "string" && (WORKSPACE_TABS as readonly string[]).includes(value);
}

type Query = Record<string, string | null | undefined> | URLSearchParams;

/** Address of a section, with optional query parameters (empty values are dropped). */
export function tabPath(tab: TabId, query?: Query): string {
  const search = new URLSearchParams();
  if (query instanceof URLSearchParams) query.forEach((value, key) => search.append(key, value));
  else if (query) for (const [key, value] of Object.entries(query)) if (value !== null && value !== undefined) search.set(key, value);
  const text = search.toString();
  return `/${tab}${text ? `?${text}` : ""}`;
}

/** Which section a pathname shows. `/` is the start page and counts as Home until it forwards elsewhere. */
export function tabFromPath(pathname: string): TabId | null {
  if (pathname === "/") return "home";
  const first = pathname.split("/")[1] ?? "";
  return isTabId(first) ? first : null;
}

/** The journal filtered to specific trades (Strategy Control evidence, weekly report, calendar). */
export function journalFocusPath(ids: readonly string[] | string): string {
  return tabPath("journal", { focusTradeIds: typeof ids === "string" ? ids : ids.join(",") });
}

/**
 * Where an old `/?tab=…` link now lives, or null when the URL needs no redirect. Only the root path is
 * rewritten; other parameters (`review`, `gallery`, `report`, `week`, `focusTradeIds`) are kept as they were.
 * A focus link always opens the journal, as before; an unknown tab falls back to Home, as before.
 */
export function legacyTabDestination(pathname: string, search: URLSearchParams): string | null {
  if (pathname !== "/" || (!search.has("tab") && !search.has("focusTradeIds"))) return null;
  const requested = search.get("tab");
  const tab: TabId = search.has("focusTradeIds") ? "journal" : isTabId(requested) ? requested : "home";
  const rest = new URLSearchParams();
  search.forEach((value, key) => { if (key !== "tab") rest.append(key, value); });
  return tabPath(tab, rest);
}
