import { msg } from "./i18n/core";

/** `message` is English source text; the UI translates it (`{max}` is filled from MAX_JOURNAL_FOCUS_IDS). */
export type JournalFocus = { kind: "none" } | { kind: "invalid"; message: string } | { kind: "ids"; ids: readonly string[] };
export const NO_JOURNAL_FOCUS: JournalFocus = { kind: "none" };
export const MAX_JOURNAL_FOCUS_IDS = 150;
const MAX_TEXT = 6000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Search = { has: (name: string) => boolean; getAll: (name: string) => string[] };
export function parseJournalFocus(search: Search): JournalFocus {
  if (!search.has("focusTradeIds")) return NO_JOURNAL_FOCUS;
  const values = search.getAll("focusTradeIds");
  if (values.length !== 1) return { kind: "invalid", message: msg("The link contains an ambiguous evidence-trade filter.") };
  const text = values[0];
  if (text.length > MAX_TEXT) return { kind: "invalid", message: msg("The list of evidence trades is too long for a link. Shorten the period in Strategy Control.") };
  if (!text.trim()) return { kind: "ids", ids: [] };
  const ids = text.split(",").map(value => value.trim().toLowerCase());
  if (ids.length > MAX_JOURNAL_FOCUS_IDS) return { kind: "invalid", message: msg("The link supports up to {max} IDs. Shorten the period in Strategy Control.") };
  if (ids.some(id => !UUID.test(id))) return { kind: "invalid", message: msg("Invalid evidence-trade IDs. The full journal is not opened automatically.") };
  return { kind: "ids", ids: [...new Set(ids)] };
}
// The caller supplies current account-scoped visibleTrades. Selection only narrows that input.
export function applyJournalFocus<T extends { id: string }>(trades: readonly T[], focus: JournalFocus): T[] {
  if (focus.kind === "none") return [...trades];
  if (focus.kind === "invalid") return [];
  const ids = new Set(focus.ids);
  return trades.filter(trade => ids.has(trade.id.toLowerCase()));
}
export function journalAliasDestination(value: string | string[] | undefined): string {
  const search = new URLSearchParams({ tab: "journal" });
  if (value !== undefined) {
    const values = Array.isArray(value) ? value : [value];
    search.set("focusTradeIds", values.length === 1 && values[0].length <= MAX_TEXT ? values[0] : "invalid");
  }
  return `/?${search.toString()}`;
}
