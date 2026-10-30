import type { AccountSetup } from "../src/lib/account-setup";
import type { AccountInput } from "../src/hooks/use-trades";

const setup: AccountSetup = { accountType: "prop", platform: "manual", initialBalance: 10000, phase: "phase-3", targetPercent: null, maxLossPercent: null, dailyLossPercent: null, minTradingDays: null };
export const accountFromSetup: AccountInput = { ...setup, name: "Contract check", source: "manual", kind: "manual", currency: "USD" };
export const explicitClear: AccountInput = { ...accountFromSetup, phase: null, targetPercent: null, maxLossPercent: null, dailyLossPercent: null, minTradingDays: null };
export const omittedSettings: AccountInput = { name: "Contract check", platform: "manual", source: "manual", kind: "manual", currency: "USD", initialBalance: 10000 };
export const personalMt5: AccountInput = { ...explicitClear, accountType: "personal", platform: "mt5", source: "mt5", kind: "mt5_bridge", mt5Login: "12345" };
