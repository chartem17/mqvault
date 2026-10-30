import { AccountSetupError, type PropPhase } from "./account-setup";
import { legacyRuleCondition, parsePropRuleSettings, type PropRuleSettings } from "./prop-rule-settings";
type Row = Record<string, unknown>;
const own = (row: Row, key: string) => Object.prototype.hasOwnProperty.call(row, key);
const conditions = { target: ["prop_target_state", "target_percent"], maxLoss: ["prop_max_loss_state", "max_loss_percent"], dailyLoss: ["prop_daily_loss_state", "daily_loss_percent"], minTradingDays: ["prop_min_days_state", "min_trading_days"] } as const;
const fields = { maxLossMode: "prop_max_loss_mode", dayTimezone: "prop_day_timezone", dayClose: "prop_day_close", lossControlBasis: "prop_loss_control_basis", notes: "prop_rules_notes" } as const;
export const PROP_RULE_SELECT = "id,account_type,phase,target_percent,max_loss_percent,daily_loss_percent,min_trading_days,prop_target_state,prop_max_loss_state,prop_daily_loss_state,prop_min_days_state,prop_max_loss_mode,prop_day_timezone,prop_day_close,prop_loss_control_basis,prop_rules_notes,prop_rules_revision";
export type PropRuleRecord = { accountId: string; revision: number; phase: PropPhase | null; settings: PropRuleSettings };
export class RuleRevisionConflict extends Error {}
function record(value: unknown): Row { if (!value || typeof value !== "object" || Array.isArray(value)) throw new AccountSetupError("Invalid rule payload"); return value as Row; }
function number(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value) && Number.isFinite(Number(value))) return Number(value);
  throw new AccountSetupError("Invalid stored rule value");
}
function phase(value: unknown): PropPhase | null {
  if (value === null) return null;
  if (typeof value === "string" && ["phase-1", "phase-2", "phase-3", "funded"].includes(value)) return value as PropPhase;
  throw new AccountSetupError("Invalid prop phase");
}
function revision(value: unknown): number { if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 2147483647) throw new AccountSetupError("Invalid rule revision"); return value; }
export function settingsFromColumns(row: Row): PropRuleSettings {
  const value: Row = {};
  for (const [key, [stateColumn, valueColumn]] of Object.entries(conditions)) {
    const stored = number(row[valueColumn]);
    value[key] = row[stateColumn] === null || row[stateColumn] === undefined ? legacyRuleCondition(stored, key === "minTradingDays") : { state: row[stateColumn], value: stored };
  }
  for (const [key, column] of Object.entries(fields)) value[key] = row[column] ?? null;
  if (typeof value.dayClose === "string" && /^\d{2}:\d{2}:00$/.test(value.dayClose)) value.dayClose = value.dayClose.slice(0, 5);
  return parsePropRuleSettings(value);
}
export function ruleRecordFromColumns(row: Row): PropRuleRecord {
  if (row.account_type !== "prop" || typeof row.id !== "string") throw new AccountSetupError("A prop account is required");
  return { accountId: row.id, revision: revision(row.prop_rules_revision), phase: phase(row.phase === "manual" ? null : row.phase ?? null), settings: settingsFromColumns(row) };
}
export function parseRuleRecord(value: unknown, accountId: string): PropRuleRecord {
  const row = record(value);
  if (row.accountId !== accountId) throw new AccountSetupError("Rule response belongs to another account");
  return { accountId, revision: revision(row.revision), phase: phase(row.phase), settings: parsePropRuleSettings(row.settings) };
}
export function preparePropRuleUpdate(value: unknown, row: Row) {
  const body = record(value);
  if (Object.keys(body).some(key => !["expectedRevision", "settings", "phase"].includes(key))) throw new AccountSetupError("Unknown rule update field");
  const expectedRevision = revision(body.expectedRevision);
  const current = ruleRecordFromColumns(row);
  if (expectedRevision !== current.revision) throw new RuleRevisionConflict("Умови вже змінені. Перечитайте їх перед збереженням.");
  const delta = own(body, "settings") ? record(body.settings) : {};
  const merged: Row = { ...current.settings, ...delta };
  for (const key of Object.keys(conditions) as (keyof typeof conditions)[]) if (own(delta, key)) merged[key] = { ...current.settings[key], ...record(delta[key]) };
  const settings = parsePropRuleSettings(merged);
  const payload: Row = {};
  for (const [name, [stateColumn, valueColumn]] of Object.entries(conditions)) {
    const key = name as keyof typeof conditions;
    if (!own(delta, key)) continue;
    const change = record(delta[key]);
    if (own(change, "state")) payload[stateColumn] = settings[key].state;
    if (own(change, "value")) payload[valueColumn] = settings[key].value;
  }
  for (const [name, column] of Object.entries(fields)) { const key = name as keyof typeof fields; if (own(delta, key)) payload[column] = settings[key]; }
  if (own(body, "phase")) payload.phase = phase(body.phase);
  if (Object.keys(payload).length === 0) throw new AccountSetupError("No rule changes supplied");
  return { expectedRevision, payload };
}
