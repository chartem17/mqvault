/**
 * Which journal account an MT5 login belongs to (features/mt5-bridge.md §3.7; owner's decision 2026-11-08:
 * an unknown account is created automatically and the owner is asked on Home whether it is a prop account).
 */

export type JournalAccountRef = { id: string; platform: string | null; mt5_login: string | null; mt5_server: string | null };
export type TerminalAccountRef = { login: string; server: string };
export type AccountMatch = { kind: "matched"; account_id: string } | { kind: "create" } | { kind: "ambiguous"; account_ids: string[] };

const login = (value: string | null) => (value ?? "").trim();
const server = (value: string | null) => (value ?? "").trim().toLowerCase();

export function matchAccount(terminal: TerminalAccountRef, accounts: readonly JournalAccountRef[]): AccountMatch {
  const candidates = accounts.filter(account => login(account.mt5_login) !== "" && login(account.mt5_login) === login(terminal.login));
  // A login typed without a server still matches when it is the only account with that login.
  const exact = candidates.filter(account => server(account.mt5_server) === server(terminal.server));
  const pool = exact.length ? exact : candidates.filter(account => server(account.mt5_server) === "");
  if (pool.length === 1) return { kind: "matched", account_id: pool[0].id };
  if (pool.length > 1) return { kind: "ambiguous", account_ids: pool.map(account => account.id) };
  return { kind: "create" };
}

/** Name of an automatically created account: "<company> · <login>", bounded like any account name. */
export function autoAccountName(company: string | null, terminalLogin: string): string {
  const firm = (company ?? "").replace(/\s+/g, " ").trim();
  return `${firm ? `${firm.slice(0, 60)} · ` : "MT5 · "}${terminalLogin.trim().slice(0, 30)}`;
}

/**
 * State of a terminal account row: never matched yet, linked to an account, or "ignored" — matched once and the
 * account was since deleted (account_id was set to null by the foreign key). Ignored accounts are never re-created.
 */
export function terminalAccountState(row: { account_id: string | null; matched_at: string | null; ignored_at?: string | null }): "new" | "linked" | "ignored" {
  if (row.ignored_at) return "ignored";
  if (row.account_id) return "linked";
  return row.matched_at ? "ignored" : "new";
}

export type ReviewDecision = { id: string; decision: "confirm" | "ignore" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Owner's answer to "new MT5 account found": keep it (after setting the type in the journal) or stop syncing it. */
export function parseReviewDecision(body: unknown): ReviewDecision | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const row = body as Record<string, unknown>;
  if (Object.keys(row).some(key => key !== "id" && key !== "decision")) return null;
  if (typeof row.id !== "string" || !UUID.test(row.id)) return null;
  if (row.decision !== "confirm" && row.decision !== "ignore") return null;
  return { id: row.id.toLowerCase(), decision: row.decision };
}

/** Suggested starting balance / prop size: the sum of deposits (balance deals with a positive amount). */
export function depositsTotal(balanceDeals: readonly { type: number; profit: number }[]): number | null {
  const total = balanceDeals.filter(deal => deal.type === 2 && deal.profit > 0).reduce((sum, deal) => sum + deal.profit, 0);
  return total > 0 ? Math.round(total * 100) / 100 : null;
}
