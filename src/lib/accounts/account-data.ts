import type { AccountType, PropPhase } from "./account-setup";
import { msg } from "../i18n/core";
export type { AccountType } from "./account-setup";
export type AccountPhase = PropPhase | "manual";
export type AccountStatus = "active" | "passed" | "failed" | "archived";
export type AccountSource = "manual" | "mt5";
export type AccountPlatform = "manual" | "mt5";
export type AccountKind = "manual" | "mt5_bridge" | "sync_api";

export type TradingAccount = {
  id: string;
  accountType?: AccountType;
  minTradingDays?: number;
  /** Previous stage of the same prop branch (Phase 1 → Phase 2 → Funded). */
  parentAccountId?: string;
  name: string;
  broker: string;
  platform: AccountPlatform;
  source: AccountSource;
  kind: AccountKind;
  currency: "USD" | "USDT";
  initialBalance: number;
  phase: AccountPhase;
  targetPercent?: number;
  maxLossPercent?: number;
  dailyLossPercent?: number;
  status: AccountStatus;
  mt5Login?: string;
  mt5Server?: string;
  color: string;
  /** IANA zone of the broker/terminal clock; manually typed trade times are read in it. */
  brokerTimezone?: string;
};

export const phaseLabel: Record<AccountPhase, string> = {
  manual: msg("Manual"),
  "phase-1": "Phase 1",
  "phase-2": "Phase 2",
  "phase-3": "Phase 3",
  funded: msg("Funded"),
};

export const kindLabel: Record<AccountKind, string> = {
  manual: msg("Manual journal"),
  mt5_bridge: msg("MT5 profile · manual journal"),
  sync_api: msg("Sync via API"),
};
