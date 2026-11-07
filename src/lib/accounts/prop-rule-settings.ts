import { AccountSetupError } from "./account-setup";
export type ConditionState = "unknown" | "not_applicable" | "configured";
export type RuleCondition = { state: ConditionState; value: number | null };
export type PropRuleSettings = { target: RuleCondition; maxLoss: RuleCondition; dailyLoss: RuleCondition; minTradingDays: RuleCondition };
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
  if (Object.keys(input).some(key => !["target", "maxLoss", "dailyLoss", "minTradingDays"].includes(key))) return fail("Unknown prop settings field");
  return { target: condition(input.target), maxLoss: condition(input.maxLoss), dailyLoss: condition(input.dailyLoss), minTradingDays: condition(input.minTradingDays, true) };
}
