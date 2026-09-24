import { ruleLibrary } from "./rule-library";
import type { RuleInstance } from "./types";

export function formatRuleParams(rule: RuleInstance): string {
  const params = rule.params;
  switch (rule.ruleType) {
    case "max_trades_per_day": return `(${params.limit ?? 3}/день)`;
    case "max_losses_per_day": return `(${params.limit ?? 2}/день)`;
    case "allowed_sessions": return `(${((params.sessions as string[]) ?? []).join(", ")})`;
    case "core_instruments": return `(${((params.pairs as string[]) ?? []).join(", ")})`;
    case "risk_range": return `(${params.min_pct ?? 0.5}–${params.max_pct ?? 2}%)`;
    case "min_planned_rr": return `(${params.min_rr ?? 2}R)`;
    case "high_risk_requires_rr": return `(${params.risk_threshold_pct ?? 1}% → ${params.min_rr ?? 2.5}R)`;
    case "risk_escalation_after_loss": return `(×${params.escalation_factor ?? 1.2})`;
    case "model_confirmation": return "(обов'язково)";
    case "emotion_filter": return `(${((params.states as string[]) ?? []).join(", ")})`;
    default: return ruleLibrary[rule.ruleType].title;
  }
}
