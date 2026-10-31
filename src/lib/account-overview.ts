import { phaseLabel, type TradingAccount } from "./account-data";
type OverviewAccount = Pick<TradingAccount, "id" | "accountType" | "phase" | "initialBalance" | "targetPercent" | "maxLossPercent" | "dailyLossPercent" | "minTradingDays">;
type OverviewTrade = { account_id: string; net_pnl?: number | null };
function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function checked(value: number): number | null { return finite(value) ? value : null; }
function rate(value: unknown): number | null { return finite(value) && value > 0 && value <= 100 ? value : null; }
export function accountOverviewLabel(account: Pick<OverviewAccount, "accountType" | "phase">): string {
  if (account.accountType === "personal") return "Особистий рахунок";
  if (account.accountType !== "prop") return "Тип рахунку не задано";
  return `Проп · ${account.phase === "manual" ? "Не задано" : phaseLabel[account.phase] ?? "Не задано"}`;
}
export function buildAccountOverview(account: OverviewAccount, trades: readonly OverviewTrade[]) {
  const entries = trades.filter(trade => trade.account_id === account.id);
  const missingPnlCount = entries.filter(trade => !finite(trade.net_pnl)).length;
  const sum = entries.reduce((total, trade) => total + (finite(trade.net_pnl) ? trade.net_pnl : 0), 0);
  const netPnl = missingPnlCount === 0 ? checked(sum) : null;
  const initialBalance = finite(account.initialBalance) && account.initialBalance >= 0 ? account.initialBalance : null;
  const journalBalance = initialBalance !== null && netPnl !== null ? checked(initialBalance + netPnl) : null;
  const pnlPercent = initialBalance !== null && initialBalance > 0 && netPnl !== null ? checked(netPnl / initialBalance * 100) : null;
  const isProp = account.accountType === "prop";
  const targetPercent = isProp ? rate(account.targetPercent) : null;
  const rawTarget = initialBalance !== null && initialBalance > 0 && targetPercent !== null ? checked(initialBalance * (targetPercent / 100)) : null;
  const targetAmount = rawTarget !== null && rawTarget > 0 ? rawTarget : null;
  const progressPercent = targetAmount !== null && netPnl !== null && pnlPercent !== null ? netPnl >= targetAmount ? 100 : netPnl <= 0 ? 0 : netPnl / targetAmount * 100 : null;
  const minTradingDays = isProp && Number.isSafeInteger(account.minTradingDays) && finite(account.minTradingDays) && account.minTradingDays >= 0 && account.minTradingDays <= 2147483647 ? account.minTradingDays : null;
  return { isProp, initialBalance, netPnl, journalBalance, pnlPercent, targetPercent, targetAmount, progressPercent, maxLossPercent: isProp ? rate(account.maxLossPercent) : null, dailyLossPercent: isProp ? rate(account.dailyLossPercent) : null, minTradingDays, tradeCount: entries.length, missingPnlCount };
}
