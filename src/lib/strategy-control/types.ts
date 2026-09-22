export type TradeDirection = "Long" | "Short";
export type TradeSession = "Asia" | "London" | "NY" | "Other";
export type RuleStatus = "ok" | "warning" | "critical" | "insufficient";

export type Trade = {
  id: string;
  date: string;
  pair: string;
  direction: TradeDirection;
  session: TradeSession;
  resultR: number;
  riskPct: number;
  emotion?: "Calm" | "Angry" | "Neutral" | "Tired";
  modelConfirmed?: boolean;
};

export type RuleFinding = {
  id: string;
  title: string;
  category: string;
  status: RuleStatus;
  violations: number;
  affectedTrades: number;
  impactR: number;
  sampleSize: number;
  message: string;
  recommendation: string | null;
};

export type StrategyAnalysis = {
  period: { start: string; end: string };
  trades: number;
  winRate: number;
  totalR: number;
  averageR: number;
  averageRisk: number;
  compliance: number;
  disciplineRisk: number;
  findings: RuleFinding[];
  recommendations: string[];
};
