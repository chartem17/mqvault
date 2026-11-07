import { dayKey } from "../time/timezone";
import { msg } from "../i18n/core";

/**
 * Day review: a fast queue of trades that still need the trader's own marks
 * (setup, emotion, followed plan, mistake). Nothing is inferred: a field the
 * trader leaves empty stays empty. The review mark itself lives in
 * `journal_trades.meta.review`, so a reviewed trade leaves the queue even when
 * some fields were deliberately left blank.
 */
export type TradeReview = { reviewed_at: string; followed_plan: boolean | null };
export type ReviewChips = { setups: string[]; mistakes: string[] };
export type ReviewTrade = {
  id: string;
  account_id: string;
  opened_at: string;
  closed_at?: string | null;
  net_pnl?: number | null;
  setup?: string | null;
  emotion?: string | null;
  mistake?: string | null;
  notes?: string | null;
  review?: TradeReview | null;
};
export type ReviewDay<T extends ReviewTrade> = { day: string; trades: T[]; net: number | null };
export type ReviewDraft = { setup: string; emotion: string; mistake: string; followedPlan: boolean | null; notes: string };

/** Values the strategy engine understands (`emotion_filter`); stored as-is. */
export const REVIEW_EMOTIONS = [msg("Calm"), msg("Neutral"), msg("Tired"), msg("Angry")] as const;
export const DEFAULT_SETUPS = [msg("Breakout"), msg("Retest"), msg("Pullback"), msg("Reversal"), msg("Range")];
export const DEFAULT_MISTAKES = [msg("Early entry"), msg("Late entry"), msg("No setup"), msg("Moved stop"), msg("Oversized"), msg("Early exit"), msg("Revenge trade"), msg("Ignored news")];
export const MAX_CHIP_LENGTH = 60;
export const MAX_CHIPS = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Reads `meta.review`; anything malformed counts as "not reviewed". */
export function parseTradeReview(meta: unknown): TradeReview | null {
  if (!isRecord(meta) || !isRecord(meta.review)) return null;
  const { reviewed_at, followed_plan } = meta.review;
  if (typeof reviewed_at !== "string" || Number.isNaN(Date.parse(reviewed_at))) return null;
  return { reviewed_at, followed_plan: typeof followed_plan === "boolean" ? followed_plan : null };
}

/**
 * Value for `meta.review` from a PATCH body field: `{ followed_plan }` marks the trade reviewed now,
 * `null` clears the mark. Returns undefined for anything else (the field is then rejected).
 */
export function reviewFromInput(input: unknown, now = new Date()): TradeReview | null | undefined {
  if (input === null) return null;
  if (!isRecord(input)) return undefined;
  const plan = input.followed_plan;
  if (plan !== undefined && plan !== null && typeof plan !== "boolean") return undefined;
  return { reviewed_at: now.toISOString(), followed_plan: typeof plan === "boolean" ? plan : null };
}

const filled = (value?: string | null) => Boolean(value?.trim());

/** A trade needs review until it is marked reviewed or already carries both a setup and an emotion. */
export function needsReview(trade: ReviewTrade): boolean {
  if (trade.review?.reviewed_at) return false;
  return !filled(trade.setup) || !filled(trade.emotion);
}

/** Trades to review grouped by the user's calendar day: newest day first, trades of a day in the order they were opened. */
export function reviewQueue<T extends ReviewTrade>(trades: readonly T[], timezone: string): ReviewDay<T>[] {
  const days = new Map<string, T[]>();
  for (const trade of trades) {
    if (!needsReview(trade)) continue;
    const ms = Date.parse(trade.opened_at);
    if (!Number.isFinite(ms)) continue;
    const day = dayKey(ms, timezone);
    const list = days.get(day);
    if (list) list.push(trade); else days.set(day, [trade]);
  }
  return [...days.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([day, list]) => {
      const sorted = [...list].sort((a, b) => Date.parse(a.opened_at) - Date.parse(b.opened_at) || a.id.localeCompare(b.id));
      const net = sorted.every(trade => typeof trade.net_pnl === "number") ? sorted.reduce((sum, trade) => sum + (trade.net_pnl as number), 0) : null;
      return { day, trades: sorted, net };
    });
}

/** Clean chip text: trimmed, single spaces, length-limited; empty for nothing usable. */
export function cleanChip(value: unknown): string {
  if (typeof value !== "string") return "";
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > MAX_CHIP_LENGTH ? "" : text;
}

function uniqueChips(values: Iterable<unknown>): string[] {
  const seen = new Set<string>(), out: string[] = [];
  for (const value of values) {
    const chip = cleanChip(value);
    const key = chip.toLowerCase();
    if (!chip || seen.has(key)) continue;
    seen.add(key); out.push(chip);
    if (out.length >= MAX_CHIPS) break;
  }
  return out;
}

/** Strategy-defined chip lists from `strategy_rules.definition.review`; missing or invalid lists are empty. */
export function parseReviewChips(value: unknown): ReviewChips {
  const source = isRecord(value) ? value : {};
  const list = (input: unknown) => (Array.isArray(input) ? uniqueChips(input) : []);
  return { setups: list(source.setups), mistakes: list(source.mistakes) };
}

/** Values already used in the journal, most frequent first. */
export function usedValues(values: Iterable<string | null | undefined>): string[] {
  const counts = new Map<string, { chip: string; count: number }>();
  for (const value of values) {
    const chip = cleanChip(value);
    if (!chip) continue;
    const key = chip.toLowerCase();
    const entry = counts.get(key);
    if (entry) entry.count++; else counts.set(key, { chip, count: 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.chip.localeCompare(b.chip)).map(entry => entry.chip);
}

/** Chip order: the strategy's own list, then what the journal already uses, then built-in suggestions. Case-insensitive duplicates are dropped. */
export function chipOptions(strategy: readonly string[], used: readonly string[], defaults: readonly string[]): string[] {
  return uniqueChips([...strategy, ...used, ...defaults]);
}

export function draftFor(trade: ReviewTrade): ReviewDraft {
  return { setup: trade.setup ?? "", emotion: trade.emotion ?? "", mistake: trade.mistake ?? "", followedPlan: trade.review?.followed_plan ?? null, notes: trade.notes ?? "" };
}

/** PATCH body for `/api/journal/trades`. Empty fields are sent as null, so clearing a chip clears the field. */
export function reviewPatch(id: string, draft: ReviewDraft) {
  const value = (text: string) => cleanChip(text) || null;
  const notes = draft.notes.trim();
  return { id, setup: value(draft.setup), emotion: value(draft.emotion), mistake: value(draft.mistake), notes: notes || null, review: { followed_plan: draft.followedPlan } };
}

/** PATCH body that only marks the trade reviewed and keeps every field as it is. */
export function markReviewedPatch(trade: ReviewTrade) {
  return { id: trade.id, review: { followed_plan: trade.review?.followed_plan ?? null } };
}
