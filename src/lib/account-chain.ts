import { dayKeyOrNull } from "./timezone";
import { msg } from "./i18n/core";

/** Prop stages are linked into one linear branch through `parentAccountId` (Phase 1 → Phase 2 → Funded). */
export type ChainAccount = { id: string; accountType?: string; parentAccountId?: string | null };
type ChainTrade = { account_id: string; opened_at: string; net_pnl?: number | null };

const MAX_CHAIN = 20;

/** Accounts of the branch containing `accountId`, ordered from the first stage to the last. Cycle-safe. */
export function chainOf<T extends ChainAccount>(accountId: string, accounts: readonly T[]): T[] {
  const byId = new Map(accounts.map(account => [account.id, account]));
  const start = byId.get(accountId);
  if (!start) return [];
  const seen = new Set<string>([start.id]);
  const up: T[] = [start];
  for (let current = start; up.length < MAX_CHAIN;) {
    const parent = current.parentAccountId ? byId.get(current.parentAccountId) : undefined;
    if (!parent || seen.has(parent.id)) break;
    seen.add(parent.id); up.unshift(parent); current = parent;
  }
  const tail: T[] = [];
  for (let current = start; up.length + tail.length < MAX_CHAIN;) {
    const child = accounts.find(account => account.parentAccountId === current.id && !seen.has(account.id));
    if (!child) break;
    seen.add(child.id); tail.push(child); current = child;
  }
  return [...up, ...tail];
}

/** Would making `parentId` the parent of `accountId` be valid? Returns an error message or null. */
export function linkError(accountId: string, parentId: string | null, accounts: readonly ChainAccount[]): string | null {
  if (parentId === null) return null;
  if (parentId === accountId) return msg("An account cannot be its own previous stage");
  const byId = new Map(accounts.map(account => [account.id, account]));
  const parent = byId.get(parentId), child = byId.get(accountId);
  if (!parent || !child) return msg("Account not found");
  if (parent.accountType !== "prop" || child.accountType !== "prop") return msg("Only prop accounts can be linked");
  for (let current: ChainAccount | undefined = parent, steps = 0; current && steps <= MAX_CHAIN; steps++) {
    if (current.id === accountId) return msg("That would create a loop: this account is already a previous stage of the selected one");
    current = current.parentAccountId ? byId.get(current.parentAccountId) : undefined;
  }
  if (accounts.some(account => account.parentAccountId === parentId && account.id !== accountId)) return msg("This stage already has a next account");
  return null;
}

export type ChainSummary = { tradeCount: number; tradingDays: number; netPnl: number | null; missingPnlCount: number };

/** Combined journal facts for the whole branch. Days are counted in the user's zone; no pass/fail is implied. */
export function summarizeChain(chain: readonly ChainAccount[], trades: readonly ChainTrade[], timezone: string): ChainSummary {
  const ids = new Set(chain.map(account => account.id));
  const entries = trades.filter(trade => ids.has(trade.account_id));
  const days = new Set<string>();
  let sum = 0, missing = 0;
  for (const trade of entries) {
    const day = dayKeyOrNull(trade.opened_at, timezone);
    if (day) days.add(day);
    if (typeof trade.net_pnl === "number" && Number.isFinite(trade.net_pnl)) sum += trade.net_pnl; else missing++;
  }
  return { tradeCount: entries.length, tradingDays: days.size, netPnl: missing === 0 ? sum : null, missingPnlCount: missing };
}
