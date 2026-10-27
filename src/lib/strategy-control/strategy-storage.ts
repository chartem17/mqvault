import { ruleLibrary } from "./rule-library";
import { normalizeSessionSelections, sessionSelectionLabel } from "../session-selection";
import type { RuleInstance, RuleType, StrategyProfile } from "./types";

export class StrategyInputError extends Error {}
export const STRATEGY_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
export function parseStrategyRules(value: unknown): RuleInstance[] {
  if (!Array.isArray(value) || value.length > Object.keys(ruleLibrary).length) throw new StrategyInputError("Invalid rules list");
  const seen = new Set<string>();
  return value.map(item => {
    if (!isRecord(item) || typeof item.ruleType !== "string" || !Object.prototype.hasOwnProperty.call(ruleLibrary, item.ruleType) || typeof item.enabled !== "boolean" || seen.has(item.ruleType)) throw new StrategyInputError("Invalid or duplicated rule type");
    seen.add(item.ruleType);
    const ruleType = item.ruleType as RuleType;
    const schema = ruleLibrary[ruleType];
    const supplied = item.params === undefined ? {} : item.params;
    if (!isRecord(supplied) || Object.keys(supplied).some(key => !schema.paramsSchema.some(field => field.key === key))) throw new StrategyInputError(`Invalid parameters for ${ruleType}`);
    const params: Record<string, unknown> = {};
    for (const field of schema.paramsSchema) {
      const parameter = supplied[field.key] === undefined ? schema.defaultParams[field.key] : supplied[field.key];
      if (field.type === "number") {
        if (typeof parameter !== "number" || !Number.isFinite(parameter) || (field.min !== undefined && parameter < field.min) || (field.max !== undefined && parameter > field.max) || (field.step === 1 && !Number.isInteger(parameter))) throw new StrategyInputError(`Invalid ${ruleType}.${field.key}`);
        params[field.key] = parameter;
      } else if (field.type === "boolean") {
        if (typeof parameter !== "boolean") throw new StrategyInputError(`Invalid ${ruleType}.${field.key}`);
        params[field.key] = parameter;
      } else {
        if (!Array.isArray(parameter) || parameter.length > 200 || parameter.some(entry => typeof entry !== "string" || entry.length === 0 || entry.length > 100)) throw new StrategyInputError(`Invalid ${ruleType}.${field.key}`);
        if (ruleType === "allowed_sessions" && field.key === "sessions") {
          try { params[field.key] = normalizeSessionSelections(parameter as string[]).map(sessionSelectionLabel); }
          catch { throw new StrategyInputError(`Invalid ${ruleType}.${field.key}`); }
        } else {
          if (field.type === "session_list" && field.options && parameter.some(entry => !field.options!.includes(entry))) throw new StrategyInputError(`Invalid ${ruleType}.${field.key}`);
          params[field.key] = [...new Set(parameter as string[])];
        }
      }
    }
    if (ruleType === "risk_range" && Number(params.min_pct) > Number(params.max_pct)) throw new StrategyInputError("Minimum risk exceeds maximum risk");
    return { ruleType, enabled: item.enabled, params };
  });
}
export type StoredStrategy = { id: string; account_id: string; name: string; description: string | null; created_at: string; definition: unknown; source_strategy_id?: string | null };
export function toStrategyProfile(row: StoredStrategy): StrategyProfile {
  if (!STRATEGY_UUID.test(row.id) || !isRecord(row.definition)) throw new StrategyInputError("Invalid stored strategy");
  return { id: row.id, name: row.name, description: row.description ?? "", createdAt: row.created_at.slice(0, 10), rules: parseStrategyRules(row.definition.rules) };
}
