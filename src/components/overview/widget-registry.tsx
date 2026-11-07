"use client";
import type { ComponentType } from "react";
import { WIDGETS } from "@/lib/dashboard/dashboard-widgets";
import { AvgLossWidget, AvgRWidget, AvgWinWidget, BestTradeWidget, NetPnlWidget, ProfitFactorWidget, WinrateWidget, WorstTradeWidget } from "./metric-widgets";
import { EquityWidget } from "./equity-widget";
import { CalendarWidget } from "./calendar-widget";
import { DrawdownWidget } from "./drawdown-widget";
import { RDistributionWidget } from "./r-distribution-widget";
import { StreaksWidget } from "./streaks-widget";
import { EmotionsWidget, MonthlyWidget, SessionsWidget, SymbolsWidget } from "./breakdown-widgets";
import { RiskWidget } from "./risk-widget";
import { EarnLoseWidget, WeekdayHourWidget } from "./earn-lose-widgets";

/** key → component. Metadata (title, sizes) lives in `@/lib/dashboard-widgets`; a test keeps the two lists in sync. */
export const WIDGET_COMPONENTS: Record<string, ComponentType> = {
  net_pnl: NetPnlWidget, winrate: WinrateWidget, avg_r: AvgRWidget, profit_factor: ProfitFactorWidget,
  equity: EquityWidget, calendar: CalendarWidget, drawdown: DrawdownWidget, r_distribution: RDistributionWidget,
  best_trade: BestTradeWidget, worst_trade: WorstTradeWidget, avg_win: AvgWinWidget, avg_loss: AvgLossWidget,
  streaks: StreaksWidget, monthly: MonthlyWidget, symbols: SymbolsWidget, sessions: SessionsWidget, risk: RiskWidget, emotions: EmotionsWidget,
  earn_lose: EarnLoseWidget, weekday_hour: WeekdayHourWidget,
};
export const REGISTERED_KEYS = Object.keys(WIDGET_COMPONENTS);
export const CATALOGUE_KEYS = WIDGETS.map(widget => widget.key);
