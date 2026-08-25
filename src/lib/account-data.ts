export type AccountPhase = "phase-1" | "phase-2" | "funded" | "manual";
export type AccountStatus = "active" | "passed" | "failed" | "archived";
export type AccountSource = "manual" | "mt5";

export type TradingAccount = {
  id: string;
  name: string;
  broker: string;
  platform: "manual" | "mt5";
  source: AccountSource;
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

export const initialAccounts: TradingAccount[] = [
  { id: "manual", name: "Manual journal", broker: "Personal", platform: "manual", source: "manual", currency: "USD", initialBalance: 1000, phase: "manual", status: "active", color: "#7c8cff" },
  { id: "fp5k", name: "FP5K", broker: "Prop firm", platform: "mt5", source: "mt5", currency: "USD", initialBalance: 5000, phase: "phase-2", targetPercent: 5, maxLossPercent: 10, dailyLossPercent: 5, status: "active", color: "#76d05a" },
  { id: "2phase", name: "2phase", broker: "Prop firm", platform: "mt5", source: "mt5", currency: "USD", initialBalance: 5000, phase: "phase-1", targetPercent: 8, maxLossPercent: 10, dailyLossPercent: 5, status: "active", color: "#e9ae5b" },
];

export const phaseLabel: Record<AccountPhase, string> = {
  manual: "Manual",
  "phase-1": "Phase 1",
  "phase-2": "Phase 2",
  funded: "Funded",
};
