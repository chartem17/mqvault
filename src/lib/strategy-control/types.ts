export type TradeDirection = "Long" | "Short";
export type TradeSession = "Asia" | "London" | "NY" | "Other";
export type RuleStatus = "ok" | "warning" | "critical" | "insufficient";
export type ComplianceStatus = "passed" | "violated";
export type ImpactStatus = "positive" | "negative" | "neutral" | "unknown";
export type Confidence = "low" | "medium" | "high";

export type Trade = {
  id: string;
  date: string;
  pair: string;
  direction: TradeDirection;
  session: TradeSession;
  resultR: number;
  resultUsd?: number;
  riskPct: number;
  plannedRR?: number;
  emotion?: "Calm" | "Angry" | "Neutral" | "Tired";
  modelConfirmed?: boolean;
};

export type RuleType =
  | "max_trades_per_day"
  | "max_losses_per_day"
  | "allowed_sessions"
  | "core_instruments"
  | "model_confirmation"
  | "emotion_filter"
  | "risk_range"
  | "min_planned_rr"
  | "high_risk_requires_rr"
  | "risk_escalation_after_loss";

export type ParamType = "number" | "session_list" | "pair_list" | "boolean";

export type ParamDefinition = {
  key: string;
  label: string;
  type: ParamType;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
};

export type RuleDefinition = {
  ruleType: RuleType;
  title: string;
  category: "discipline" | "risk" | "session" | "setup" | "psychology";
  description: string;
  paramsSchema: ParamDefinition[];
  defaultParams: Record<string, unknown>;
};

export type RuleInstance = {
  ruleType: RuleType;
  enabled: boolean;
  params: Record<string, unknown>;
};

export type StrategyProfile = {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  rules: RuleInstance[];
};

export type RuleFinding = {
  ruleType: RuleType;
  title: string;
  category: string;
  complianceStatus: ComplianceStatus;
  impactStatus: ImpactStatus;
  confidence: Confidence;
  status: RuleStatus;
  violations: number;
  affectedTrades: number;
  impactR: number;
  sampleSize: number;
  compliantCount: number;
  compliantAvgR: number | null;
  violatedAvgR: number | null;
  evidenceTradeIds: string[];
  evidenceTrades: Trade[];
  message: string;
  recommendation: string | null;
};

export type StrategyAnalysis = {
  strategyId: string;
  strategyName: string;
  period: { start: string; end: string };
  trades: number;
  checkedTrades: number;
  cleanTrades: number;
  compliance: number;
  winRate: number;
  totalR: number;
  averageR: number;
  averageRisk: number;
  averagePlannedRR: number | null;
  medianPlannedRR: number | null;
  disciplineRisk: number;
  findings: RuleFinding[];
  recommendations: string[];
};
