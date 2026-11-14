/**
 * Trade plan: the pre-trade checklist that must pass BEFORE an entry (table `trade_plans`).
 * The same `planGate` runs in the browser (to show what blocks the save button) and on the server
 * (to refuse anything that does not pass) — there is no way around it through the API.
 */
import { msg } from "../i18n/core";
import { inEntryWindow, toPrice, type DayStatus, type PlaybookTrade, type RiskState } from "./engine";
import type { PlaybookConfig } from "./config";

export const POI_TYPES = ["fvg", "swing", "compression"] as const;
export const REACTIONS = ["sweep", "fvg"] as const;
export const BOS_TIMEFRAMES = ["M5", "M15"] as const;
export const RISK_EXCEPTIONS = ["none", "add_on", "metal_lot"] as const;
export type PoiType = typeof POI_TYPES[number];
export type Reaction = typeof REACTIONS[number];
export type BosTimeframe = typeof BOS_TIMEFRAMES[number];
export type RiskException = typeof RISK_EXCEPTIONS[number];
export type Direction = "Long" | "Short";

export const POI_LABEL: Record<PoiType, string> = { fvg: msg("FVG"), swing: msg("Swing"), compression: msg("Compression") };
export const REACTION_LABEL: Record<Reaction, string> = { sweep: msg("Sweep"), fvg: msg("FVG reaction") };
export const EXCEPTION_LABEL: Record<RiskException, string> = { none: msg("By the rule"), add_on: msg("Add-on (main position at break-even)"), metal_lot: msg("Metals: lot size limit") };

/** What the trader fills in. Empty text = not filled; null = not chosen. */
export type PlanDraft = {
  account_id: string;
  symbol: string;
  direction: Direction | null;
  at_desk: boolean;
  context: string;
  poi_type: PoiType | null;
  poi_note: string;
  poi_swept: boolean;
  reaction: Reaction | null;
  bos_timeframe: BosTimeframe | null;
  bos_body_close: boolean;
  limit_on_fvg: boolean;
  m3_refined: boolean;
  entry: number | null;
  stop: number | null;
  target: number | null;
  risk_exception: RiskException;
  /** Only read for an exception; otherwise the risk is the rule's. */
  risk_pct: number | null;
  screenshot_url: string;
  reason: string;
};

export type PlanStatus = "active" | "cancelled";

/** Stored plan as the API returns it. */
export type TradePlan = Omit<PlanDraft, "direction" | "poi_type" | "reaction" | "bos_timeframe" | "risk_pct" | "entry" | "stop" | "target"> & {
  id: string;
  entry: number;
  stop: number;
  target: number;
  direction: Direction;
  poi_type: PoiType;
  reaction: Reaction;
  bos_timeframe: BosTimeframe;
  risk_pct: number;
  rr: number;
  status: PlanStatus;
  /** Manual link to a journal trade; null = matched automatically (or not yet). */
  trade_id: string | null;
  created_at: string;
};

export const EMPTY_DRAFT: PlanDraft = {
  account_id: "", symbol: "", direction: null, at_desk: false, context: "", poi_type: null, poi_note: "", poi_swept: false,
  reaction: null, bos_timeframe: null, bos_body_close: false, limit_on_fvg: false, m3_refined: false,
  entry: null, stop: null, target: null, risk_exception: "none", risk_pct: null, screenshot_url: "", reason: "",
};

/** Reward / risk from prices; null when the levels are missing or on the wrong side. */
export function planRR(direction: Direction | string | null, entry: number | null, stop: number | null, target: number | null): number | null {
  if (entry === null || stop === null || target === null || (direction !== "Long" && direction !== "Short")) return null;
  const risk = direction === "Long" ? entry - stop : stop - entry;
  const reward = direction === "Long" ? target - entry : entry - target;
  if (!(risk > 0) || !(reward > 0)) return null;
  return Math.round(reward / risk * 100) / 100;
}

export type GateCheck = { id: string; label: string; ok: boolean; auto: boolean; detail?: string; vars?: Record<string, string | number> };
export type GateContext = { now: number; day: DayStatus; risk: RiskState; config: PlaybookConfig };

const filled = (text: string, min = 3) => text.trim().length >= min;
export const isScreenshotUrl = (value: string) => { try { const url = new URL(value.trim()); return url.protocol === "https:" || url.protocol === "http:"; } catch { return false; } };

/** The risk a plan gets: the rule's level, or the trader's number for a flagged exception. */
export function planRisk(draft: Pick<PlanDraft, "risk_exception" | "risk_pct">, risk: RiskState): number | null {
  return draft.risk_exception === "none" ? risk.riskPct : draft.risk_pct;
}

/** Every item of the checklist, in order. The plan can be saved only when all are ok. */
export function planGate(draft: PlanDraft, ctx: GateContext): GateCheck[] {
  const { config } = ctx;
  const rr = planRR(draft.direction, draft.entry, draft.stop, draft.target);
  const risk = planRisk(draft, ctx.risk);
  const riskOk = draft.risk_exception === "none"
    ? true
    : risk !== null && risk > 0 && risk <= config.maxRiskPct;
  const pricesOk = Boolean(draft.direction) && draft.entry !== null && draft.stop !== null && draft.target !== null && rr !== null;
  return [
    { id: "basics", label: msg("Account, instrument and direction"), auto: false, ok: Boolean(draft.account_id) && filled(draft.symbol, 2) && Boolean(draft.direction) },
    { id: "window", label: msg("Trading window"), auto: true, ok: inEntryWindow(ctx.now, config), detail: msg("No entries outside the trading windows (lunch, evening and night).") },
    { id: "at_desk", label: msg("At the desk, set up, not out of boredom"), auto: false, ok: draft.at_desk },
    { id: "limits", label: msg("Daily limits"), auto: true, ok: ctx.day.blockedBy === null,
      detail: ctx.day.blockedBy === "losses" ? msg("{losses} stops today — trading is blocked until tomorrow.") : ctx.day.blockedBy === "trades" ? msg("{entries} of {max} trades today — the limit is used.") : undefined,
      vars: { losses: ctx.day.losses, entries: ctx.day.entries, max: ctx.day.maxTrades } },
    { id: "context", label: msg("1H/4H context in one sentence"), auto: false, ok: filled(draft.context, 10) },
    { id: "poi", label: msg("POI and its type, fully swept"), auto: false, ok: draft.poi_type !== null && filled(draft.poi_note) && draft.poi_swept },
    { id: "reaction", label: msg("Reaction: sweep or FVG"), auto: false, ok: draft.reaction !== null },
    { id: "bos", label: msg("BOS with a body close on M5/M15"), auto: false, ok: draft.bos_timeframe !== null && draft.bos_body_close },
    { id: "limit", label: msg("Limit order on the FVG"), auto: false, ok: draft.limit_on_fvg },
    { id: "prices", label: msg("Entry, stop and target prices"), auto: false, ok: pricesOk, detail: draft.entry !== null && draft.stop !== null && draft.target !== null && rr === null ? msg("The stop and the target must be on opposite sides of the entry.") : undefined },
    { id: "rr", label: msg("RR at least {min}"), auto: true, ok: rr !== null && rr >= config.minRR, vars: { min: config.minRR, rr: rr ?? "—" }, detail: rr !== null && rr < config.minRR ? msg("RR is {rr} — below the minimum.") : undefined },
    { id: "risk", label: msg("Risk by the current state"), auto: true, ok: riskOk, vars: { max: config.maxRiskPct }, detail: riskOk ? undefined : msg("Enter the risk for the exception (up to {max}%).") },
    { id: "why", label: msg("Screenshot and why this entry"), auto: false, ok: isScreenshotUrl(draft.screenshot_url) && filled(draft.reason, 10) },
  ];
}

export const gatePassed = (checks: readonly GateCheck[]) => checks.every(check => check.ok);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const record = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value as object)) : null;
const text = (value: unknown, max: number) => typeof value === "string" ? value.replace(/\u0000/g, "").trim().slice(0, max) : "";
const pick = <T extends string>(value: unknown, options: readonly T[]): T | null => options.includes(value as T) ? value as T : null;
const price = (value: unknown) => typeof value === "number" ? toPrice(value) : typeof value === "string" ? toPrice(value.replace(",", ".")) : null;

/** Draft from an untrusted body (server) — anything malformed becomes "not filled", so the gate refuses it. */
export function draftFromInput(value: unknown): PlanDraft {
  const input = record(value) ?? {};
  const risk = typeof input.risk_pct === "number" && Number.isFinite(input.risk_pct) ? Math.round(input.risk_pct * 100) / 100 : null;
  return {
    account_id: typeof input.account_id === "string" && UUID.test(input.account_id) ? input.account_id.toLowerCase() : "",
    symbol: text(input.symbol, 40).toUpperCase(),
    direction: pick(input.direction, ["Long", "Short"] as const),
    at_desk: input.at_desk === true,
    context: text(input.context, 500),
    poi_type: pick(input.poi_type, POI_TYPES),
    poi_note: text(input.poi_note, 300),
    poi_swept: input.poi_swept === true,
    reaction: pick(input.reaction, REACTIONS),
    bos_timeframe: pick(input.bos_timeframe, BOS_TIMEFRAMES),
    bos_body_close: input.bos_body_close === true,
    limit_on_fvg: input.limit_on_fvg === true,
    m3_refined: input.m3_refined === true,
    entry: price(input.entry), stop: price(input.stop), target: price(input.target),
    risk_exception: pick(input.risk_exception, RISK_EXCEPTIONS) ?? "none",
    risk_pct: risk,
    screenshot_url: text(input.screenshot_url, 500),
    reason: text(input.reason, 1000),
  };
}

/** Broker symbol without separators and suffixes: "XAUUSD.raw", "XAU/USD", "xauusdm" → comparable. */
export function symbolKey(symbol: string): string {
  return symbol.split(/[.#_\s]/)[0].replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}
export function sameSymbol(a: string, b: string): boolean {
  const x = symbolKey(a), y = symbolKey(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 6 && long.startsWith(short) && long.length - short.length <= 2;
}

export type PlanMatch = { byPlan: Map<string, string>; byTrade: Map<string, string> };
type MatchPlan = Pick<TradePlan, "id" | "account_id" | "symbol" | "direction" | "entry" | "stop" | "status" | "trade_id" | "created_at">;

/**
 * One plan ↔ one trade. A manual link wins; the rest are paired automatically by account, symbol,
 * direction, entry time (from `matchEarlyMinutes` before the plan to `matchHours` after) and entry price
 * (within `matchPriceShare` of the plan's stop distance), closest first. Cancelled plans never match.
 */
export function matchPlans(plans: readonly MatchPlan[], trades: readonly PlaybookTrade[], config: PlaybookConfig): PlanMatch {
  const byPlan = new Map<string, string>(), byTrade = new Map<string, string>();
  const tradeIds = new Set(trades.map(trade => trade.id));
  for (const plan of plans) {
    if (plan.trade_id && tradeIds.has(plan.trade_id) && !byTrade.has(plan.trade_id)) { byPlan.set(plan.id, plan.trade_id); byTrade.set(plan.trade_id, plan.id); }
  }
  const pairs: { plan: string; trade: string; score: number }[] = [];
  for (const plan of plans) {
    if (plan.status !== "active" || byPlan.has(plan.id) || plan.trade_id) continue;
    const created = Date.parse(plan.created_at);
    const distance = Math.abs(plan.entry - plan.stop);
    if (!Number.isFinite(created) || !(distance > 0)) continue;
    for (const trade of trades) {
      if (byTrade.has(trade.id) || trade.account_id !== plan.account_id || trade.direction !== plan.direction || !sameSymbol(trade.symbol, plan.symbol)) continue;
      const opened = Date.parse(trade.opened_at);
      const minutes = (opened - created) / 60_000;
      if (!Number.isFinite(opened) || minutes < -config.matchEarlyMinutes || minutes > config.matchHours * 60) continue;
      const entry = toPrice(trade.entry_price);
      if (entry === null) continue;
      const share = Math.abs(entry - plan.entry) / distance;
      if (share > config.matchPriceShare) continue;
      pairs.push({ plan: plan.id, trade: trade.id, score: share + Math.abs(minutes) / 600 });
    }
  }
  pairs.sort((a, b) => a.score - b.score || a.plan.localeCompare(b.plan) || a.trade.localeCompare(b.trade));
  for (const pair of pairs) {
    if (byPlan.has(pair.plan) || byTrade.has(pair.trade)) continue;
    byPlan.set(pair.plan, pair.trade); byTrade.set(pair.trade, pair.plan);
  }
  return { byPlan, byTrade };
}
