import { AccountSetupError } from "./account-setup";
export type ConditionState = "unknown" | "not_applicable" | "configured";
export type RuleCondition = { state: ConditionState; value: number | null };
export type PropRuleSettings = {
  target: RuleCondition; maxLoss: RuleCondition; dailyLoss: RuleCondition; minTradingDays: RuleCondition;
  maxLossMode: "static" | "eod_trailing_percent" | null;
  dayTimezone: string | null; dayClose: string | null; lossControlBasis: "balance" | "equity" | null; notes: string | null;
};
function fail(message: string): never { throw new AccountSetupError(message); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail("Invalid prop rule object");
  return value as Record<string, unknown>;
}
function condition(value: unknown, days = false): RuleCondition {
  const input = object(value);
  if (Object.keys(input).some(key => key !== "state" && key !== "value")) return fail("Unknown condition field");
  if (input.state !== "unknown" && input.state !== "not_applicable" && input.state !== "configured") return fail("Invalid condition state");
  const number = input.value;
  if (number !== null && (typeof number !== "number" || !Number.isFinite(number) || (days ? !Number.isSafeInteger(number) || number < 0 || number > 2147483647 : number <= 0 || number > 100))) return fail("Invalid condition value");
  if (input.state === "configured" && number === null) return fail("Configured condition needs a value");
  return { state: input.state, value: number as number | null };
}
export function legacyRuleCondition(value: number | null | undefined, days = false): RuleCondition {
  return condition({ state: value === null || value === undefined ? "unknown" : "configured", value: value ?? null }, days);
}
export function parsePropRuleSettings(value: unknown): PropRuleSettings {
  const input = object(value);
  const keys = ["target", "maxLoss", "dailyLoss", "minTradingDays", "maxLossMode", "dayTimezone", "dayClose", "lossControlBasis", "notes"];
  if (Object.keys(input).some(key => !keys.includes(key))) return fail("Unknown prop settings field");
  if (input.maxLossMode !== null && input.maxLossMode !== "static" && input.maxLossMode !== "eod_trailing_percent") return fail("Invalid loss mode");
  if (input.lossControlBasis !== null && input.lossControlBasis !== "balance" && input.lossControlBasis !== "equity") return fail("Invalid loss control basis");
  if (input.dayTimezone !== null) {
    if (typeof input.dayTimezone !== "string" || input.dayTimezone.length > 64 || !/^[A-Za-z][A-Za-z0-9_+./-]{2,63}$/.test(input.dayTimezone)) return fail("Invalid rule timezone");
    try { new Intl.DateTimeFormat("en", { timeZone: input.dayTimezone }).format(0); } catch { return fail("Unknown rule timezone"); }
  }
  if (input.dayClose !== null && (typeof input.dayClose !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(input.dayClose))) return fail("Invalid day close; use HH:mm");
  if (input.notes !== null && (typeof input.notes !== "string" || input.notes.length > 2000)) return fail("Rule notes must be at most 2000 characters");
  return {
    target: condition(input.target), maxLoss: condition(input.maxLoss), dailyLoss: condition(input.dailyLoss), minTradingDays: condition(input.minTradingDays, true),
    maxLossMode: input.maxLossMode, lossControlBasis: input.lossControlBasis,
    dayTimezone: input.dayTimezone as string | null, dayClose: input.dayClose as string | null, notes: typeof input.notes === "string" ? input.notes.trim() || null : null,
  };
}
function moneyUnits(value: string): bigint {
  if (typeof value !== "string" || !/^-?(?:0|[1-9]\d{0,15})(?:\.\d{1,8})?$/.test(value)) return fail("Balance must be an exact decimal with at most 8 fractional digits");
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = (negative ? value.slice(1) : value).split(".");
  const units = BigInt(whole) * BigInt(100000000) + BigInt(fraction.padEnd(8, "0"));
  return negative ? -units : units;
}
function percentageUnits(value: string): bigint {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d{0,2})(?:\.\d{1,6})?$/.test(value)) return fail("Percent must be an exact decimal with at most 6 fractional digits");
  const [whole, fraction = ""] = value.split(".");
  const units = BigInt(whole) * BigInt(1000000) + BigInt(fraction.padEnd(6, "0"));
  if (units <= BigInt(0) || units > BigInt(100000000)) return fail("Percent must be greater than 0 and at most 100");
  return units;
}
function decimal(units: bigint, scale: number): string {
  const negative = units < BigInt(0);
  const digits = (negative ? -units : units).toString().padStart(scale + 1, "0");
  const fraction = digits.slice(-scale).replace(/0+$/, "");
  return `${negative ? "-" : ""}${digits.slice(0, -scale)}${fraction ? `.${fraction}` : ""}`;
}
function instant(value: string): number {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return fail("Use a canonical UTC instant");
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) || new Date(ms).toISOString() !== value) return fail("Invalid UTC instant");
  return ms;
}
export type EodReferenceInput = {
  accountId: string; initialBalance: string; percent: string; asOf: string; completeThrough: string;
  historyComplete: boolean; cashFlowsReconciled: boolean; source: "broker" | "manual" | "journal_estimate";
  snapshots: readonly { accountId: string; closedAt: string; balance: string }[];
};
// Inputs must be prepared by a trusted server adapter. This function does not classify trading days or verify broker provenance.
export function eodTrailingReference(input: EodReferenceInput): { kind: "unavailable"; reason: string } | { kind: "reference"; peakBalance: string; floorBalance: string; completeThrough: string } {
  if (typeof input.accountId !== "string" || !input.accountId.trim()) return fail("Account id is required");
  let peak = moneyUnits(input.initialBalance);
  if (peak <= BigInt(0)) return fail("Initial balance must be positive");
  const percent = percentageUnits(input.percent);
  const now = instant(input.asOf), through = instant(input.completeThrough);
  if (through > now) return fail("History cutoff cannot be in the future");
  if (input.historyComplete !== true) return { kind: "unavailable", reason: "incomplete_history" };
  if (input.cashFlowsReconciled !== true) return { kind: "unavailable", reason: "unreconciled_cash_flows" };
  if (input.source !== "broker") return { kind: "unavailable", reason: "unverified_balance_source" };
  const seen = new Set<string>();
  for (const snapshot of input.snapshots) {
    if (snapshot.accountId !== input.accountId) return fail("Mixed account EOD history");
    if (instant(snapshot.closedAt) > through) return fail("Snapshot is after completed history cutoff");
    if (seen.has(snapshot.closedAt)) return fail("Duplicate EOD cutoff");
    seen.add(snapshot.closedAt);
    const balance = moneyUnits(snapshot.balance);
    if (balance > peak) peak = balance;
  }
  return { kind: "reference", peakBalance: decimal(peak, 8), floorBalance: decimal(peak * (BigInt(100000000) - percent), 16), completeThrough: input.completeThrough };
}
