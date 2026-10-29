export type AccountType = "personal" | "prop";
export type SetupPlatform = "manual" | "mt5";
export type PropPhase = "phase-1" | "phase-2" | "phase-3" | "funded";
export type AccountSetup = {
  accountType: AccountType;
  platform: SetupPlatform;
  initialBalance: number;
  phase: PropPhase | null;
  targetPercent: number | null;
  maxLossPercent: number | null;
  dailyLossPercent: number | null;
  minTradingDays: number | null;
};
export class AccountSetupError extends Error {}
function optionalNumber(value: unknown, field: string, integer = false): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER || (integer && !Number.isSafeInteger(value))) throw new AccountSetupError(`Invalid ${field}`);
  return value;
}
function percent(value: unknown, field: string): number | null {
  const number = optionalNumber(value, field);
  if (number !== null && (number <= 0 || number > 100)) throw new AccountSetupError(`${field} must be greater than 0 and at most 100`);
  return number;
}
export function parseAccountSetup(value: unknown): AccountSetup {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new AccountSetupError("Invalid account setup");
  const input = value as Record<string, unknown>;
  if (input.accountType !== "personal" && input.accountType !== "prop") throw new AccountSetupError("Choose personal or prop account explicitly");
  if (input.platform !== "manual" && input.platform !== "mt5") throw new AccountSetupError("Choose manual or MT5 platform explicitly");
  const initialBalance = optionalNumber(input.initialBalance, "initialBalance");
  if (initialBalance === null || initialBalance < 0 || (input.accountType === "prop" && initialBalance === 0)) throw new AccountSetupError("Initial balance must be nonnegative; prop account size must be positive");
  if (input.accountType === "personal") {
    if (input.phase !== undefined && input.phase !== null && input.phase !== "manual") throw new AccountSetupError("Personal accounts cannot have a prop phase");
    for (const field of ["targetPercent", "maxLossPercent", "dailyLossPercent", "minTradingDays"]) {
      if (input[field] !== undefined && input[field] !== null) throw new AccountSetupError("Prop conditions must be cleared for personal accounts");
    }
    return { accountType: "personal", platform: input.platform, initialBalance, phase: null, targetPercent: null, maxLossPercent: null, dailyLossPercent: null, minTradingDays: null };
  }
  const phase = input.phase ?? null;
  if (phase !== null && !["phase-1", "phase-2", "phase-3", "funded"].includes(String(phase))) throw new AccountSetupError("Invalid prop phase");
  const minTradingDays = optionalNumber(input.minTradingDays, "minTradingDays", true);
  if (minTradingDays !== null && minTradingDays < 0) throw new AccountSetupError("Minimum trading days cannot be negative");
  return {
    accountType: "prop", platform: input.platform, initialBalance, phase: phase as PropPhase | null,
    targetPercent: percent(input.targetPercent, "targetPercent"),
    maxLossPercent: percent(input.maxLossPercent, "maxLossPercent"),
    dailyLossPercent: percent(input.dailyLossPercent, "dailyLossPercent"),
    minTradingDays,
  };
}
