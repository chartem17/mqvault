/**
 * Trading system (Playbook) parameters: the single place every number of the owner's rules lives.
 * Stored per user in `app_users.preferences.playbook`; every stored or posted value goes through
 * `sanitizePlaybook`, so a broken or old value falls back to the defaults below and never breaks the UI.
 * Pure: no React, no `@/` imports (compiled alone by the unit tests).
 */
import { isValidTimeZone } from "../time/timezone";
import { msg } from "../i18n/core";

export type TradingWindow = {
  id: string;
  /** English source text for t(); the user may rename. */
  label: string;
  /** "HH:mm" wall clock in `PlaybookConfig.timezone`. */
  start: string;
  end: string;
  /** false = observation only (lunch): no new entries. */
  entries: boolean;
};

export type PlaybookConfig = {
  /** Every window and every "day" of the playbook are read on this clock. */
  timezone: string;
  /** ISO weekdays with trading windows: 1 = Monday … 7 = Sunday. */
  weekdays: number[];
  windows: TradingWindow[];
  maxTradesPerDay: number;
  maxLossesPerDay: number;
  /** Risk per trade, % of the account. */
  baseRiskPct: number;
  reducedRiskPct: number;
  /** Losing trades in a row at the base risk that switch to the reduced risk. */
  lossesToReduce: number;
  /** Winning trades taken at the reduced risk that bring the base risk back (not necessarily in a row). */
  winsToRestore: number;
  /** |R| below this is break-even: neither a win nor a loss for the risk ladder. */
  breakevenR: number;
  /** Risk above the base is allowed only for flagged add-ons or metals lot limits. */
  maxRiskPct: number;
  minRR: number;
  /** Allowed difference between the risk taken and the rule, in percentage points. */
  riskTolerancePct: number;
  /** Plan ↔ trade matching: entry may differ from the plan by this share of the plan's stop distance. */
  matchPriceShare: number;
  /** A trade may open up to this many minutes before the plan was saved (clock drift, typing). */
  matchEarlyMinutes: number;
  /** …and up to this many hours after it (a resting limit order). */
  matchHours: number;
};

export const DEFAULT_PLAYBOOK: PlaybookConfig = {
  timezone: "Europe/Kyiv",
  weekdays: [1, 2, 3, 4, 5],
  windows: [
    { id: "morning", label: msg("Morning (Frankfurt – London)"), start: "09:00", end: "12:00", entries: true },
    { id: "lunch", label: msg("Lunch — observe only"), start: "12:00", end: "14:00", entries: false },
    { id: "new-york", label: msg("New York"), start: "14:30", end: "19:00", entries: true },
  ],
  maxTradesPerDay: 3,
  maxLossesPerDay: 2,
  baseRiskPct: 1,
  reducedRiskPct: 0.5,
  lossesToReduce: 3,
  winsToRestore: 2,
  breakevenR: 0.1,
  maxRiskPct: 2,
  minRR: 2,
  riskTolerancePct: 0.15,
  matchPriceShare: 0.3,
  matchEarlyMinutes: 5,
  matchHours: 8,
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const ID = /^[a-z0-9-]{1,30}$/;
const record = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value as object)) : null;

function numberIn(value: unknown, min: number, max: number, fallback: number, digits = 2): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) return fallback;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}
const integerIn = (value: unknown, min: number, max: number, fallback: number) => numberIn(value, min, max, fallback, 0);

/** Minutes since midnight of "HH:mm". */
export function minutesOf(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

function windows(value: unknown): TradingWindow[] {
  if (!Array.isArray(value)) return DEFAULT_PLAYBOOK.windows;
  const seen = new Set<string>();
  const list: TradingWindow[] = [];
  for (const raw of value.slice(0, 8)) {
    const item = record(raw);
    if (!item || typeof item.id !== "string" || !ID.test(item.id) || seen.has(item.id)) continue;
    if (typeof item.start !== "string" || typeof item.end !== "string" || !TIME.test(item.start) || !TIME.test(item.end)) continue;
    if (minutesOf(item.end) <= minutesOf(item.start)) continue;
    const label = typeof item.label === "string" ? item.label.replace(/\u0000/g, "").trim().slice(0, 60) : "";
    seen.add(item.id);
    list.push({ id: item.id, label: label || item.id, start: item.start, end: item.end, entries: item.entries !== false });
  }
  return list.sort((a, b) => minutesOf(a.start) - minutesOf(b.start));
}

export function sanitizePlaybook(value: unknown): PlaybookConfig {
  const input = record(value) ?? {};
  const d = DEFAULT_PLAYBOOK;
  const timezone = typeof input.timezone === "string" && isValidTimeZone(input.timezone) ? input.timezone : d.timezone;
  const weekdays = Array.isArray(input.weekdays)
    ? [...new Set(input.weekdays.filter((day): day is number => Number.isInteger(day) && day >= 1 && day <= 7))].sort()
    : d.weekdays;
  const baseRiskPct = numberIn(input.baseRiskPct, 0.05, 10, d.baseRiskPct);
  const reduced = numberIn(input.reducedRiskPct, 0.05, 10, d.reducedRiskPct);
  const maxRisk = numberIn(input.maxRiskPct, 0.05, 20, d.maxRiskPct);
  return {
    timezone,
    weekdays: input.weekdays === undefined ? d.weekdays : weekdays,
    windows: input.windows === undefined ? d.windows : windows(input.windows),
    maxTradesPerDay: integerIn(input.maxTradesPerDay, 1, 50, d.maxTradesPerDay),
    maxLossesPerDay: integerIn(input.maxLossesPerDay, 1, 20, d.maxLossesPerDay),
    baseRiskPct,
    reducedRiskPct: Math.min(reduced, baseRiskPct),
    lossesToReduce: integerIn(input.lossesToReduce, 1, 20, d.lossesToReduce),
    winsToRestore: integerIn(input.winsToRestore, 1, 20, d.winsToRestore),
    breakevenR: numberIn(input.breakevenR, 0, 1, d.breakevenR),
    maxRiskPct: Math.max(maxRisk, baseRiskPct),
    minRR: numberIn(input.minRR, 0.5, 20, d.minRR),
    riskTolerancePct: numberIn(input.riskTolerancePct, 0, 2, d.riskTolerancePct),
    matchPriceShare: numberIn(input.matchPriceShare, 0.01, 2, d.matchPriceShare),
    matchEarlyMinutes: integerIn(input.matchEarlyMinutes, 0, 120, d.matchEarlyMinutes),
    matchHours: numberIn(input.matchHours, 0.25, 24, d.matchHours),
  };
}
