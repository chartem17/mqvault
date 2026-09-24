import type { StrategyProfile } from "./types";

export const mockStrategies: StrategyProfile[] = [
  {
    id: "strategy-base",
    name: "TS Base (3 угоди / 2 стопи)",
    description: "Консервативний профіль: до 3 угод на день, дозволені лише NY і London.",
    createdAt: "2026-03-01",
    rules: [
      { ruleType: "max_trades_per_day", enabled: true, params: { limit: 3 } },
      { ruleType: "max_losses_per_day", enabled: true, params: { limit: 2 } },
      { ruleType: "allowed_sessions", enabled: true, params: { sessions: ["NY", "London"] } },
      { ruleType: "core_instruments", enabled: true, params: { pairs: ["EUR/USD", "XAU/USD", "BTC/USDT"] } },
      { ruleType: "model_confirmation", enabled: true, params: {} },
      { ruleType: "emotion_filter", enabled: true, params: { states: ["Angry"] } },
      { ruleType: "risk_range", enabled: true, params: { min_pct: 0.7, max_pct: 2 } },
      { ruleType: "min_planned_rr", enabled: true, params: { min_rr: 2 } },
      { ruleType: "high_risk_requires_rr", enabled: true, params: { risk_threshold_pct: 1, min_rr: 2.5 } },
      { ruleType: "risk_escalation_after_loss", enabled: true, params: { escalation_factor: 1.2 } },
    ],
  },
  {
    id: "strategy-wide",
    name: "TS Wide (5 угод / 3 стопи)",
    description: "М'якший профіль: до 5 угод на день, дозволені всі сесії.",
    createdAt: "2026-06-01",
    rules: [
      { ruleType: "max_trades_per_day", enabled: true, params: { limit: 5 } },
      { ruleType: "max_losses_per_day", enabled: true, params: { limit: 3 } },
      { ruleType: "allowed_sessions", enabled: true, params: { sessions: ["NY", "London", "Asia"] } },
      { ruleType: "core_instruments", enabled: false, params: { pairs: ["EUR/USD", "XAU/USD", "BTC/USDT"] } },
      { ruleType: "model_confirmation", enabled: true, params: {} },
      { ruleType: "emotion_filter", enabled: false, params: { states: ["Angry"] } },
      { ruleType: "risk_range", enabled: false, params: { min_pct: 0.5, max_pct: 3 } },
      { ruleType: "min_planned_rr", enabled: false, params: { min_rr: 1.5 } },
      { ruleType: "high_risk_requires_rr", enabled: false, params: { risk_threshold_pct: 1.5, min_rr: 2 } },
      { ruleType: "risk_escalation_after_loss", enabled: true, params: { escalation_factor: 1.3 } },
    ],
  },
];
