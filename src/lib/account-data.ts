export type AccountPhase = "phase-1" | "phase-2" | "funded" | "manual";
export type AccountStatus = "active" | "passed" | "failed" | "archived";
export type AccountSource = "manual" | "mt5";
export type AccountPlatform = "manual" | "mt5";
export type AccountKind = "manual" | "mt5_bridge" | "sync_api";

export type TradingAccount = {
  id: string;
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
};

export const phaseLabel: Record<AccountPhase, string> = {
  manual: "Manual",
  "phase-1": "Phase 1",
  "phase-2": "Phase 2",
  funded: "Funded",
};

export const kindLabel: Record<AccountKind, string> = {
  manual: "Manual journal",
  mt5_bridge: "MT5 bridge",
  sync_api: "Sync via API",
};
