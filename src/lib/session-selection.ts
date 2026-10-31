import { SESSION_DEFINITIONS, SESSION_GROUPS } from "./sessions";

export const SESSION_RULE_OPTIONS = [
  ...SESSION_GROUPS.map(group => ({ value: `group:${group.key}`, label: group.label })),
  ...SESSION_DEFINITIONS.map(session => ({ value: `session:${session.key}`, label: `${session.label} (session)` })),
];
const aliases: Record<string, string> = {
  asia: "group:asia", london: "group:london", ny: "group:new_york", "new york": "group:new_york", new_york: "group:new_york",
  other: "group:off", off: "group:off", "off hours": "group:off", off_hours: "group:off",
  frankfurt: "session:frankfurt", "london lunch": "session:london_lunch", london_lunch: "session:london_lunch",
  "london after lunch": "session:london_pm", london_pm: "session:london_pm",
};
export function normalizeSessionSelection(value: string): string | null {
  const input = value.trim().toLowerCase();
  const option = SESSION_RULE_OPTIONS.find(item => item.value === input || item.label.toLowerCase() === input);
  return option?.value ?? aliases[input] ?? null;
}
export function sessionSelectionLabel(value: string): string {
  const normalized = normalizeSessionSelection(value);
  return SESSION_RULE_OPTIONS.find(option => option.value === normalized)?.label ?? value;
}
export function normalizeSessionSelections(values: string[]): string[] {
  const normalized: string[] = [];
  for (const value of values) {
    if (value.trim().toLowerCase() === "overlap") continue;
    const key = normalizeSessionSelection(value);
    if (!key) throw new Error(`Unknown session selection: ${value}`);
    if (!normalized.includes(key)) normalized.push(key);
  }
  return normalized;
}
export function matchesSessionSelection(trade: { sessionKey?: string | null; sessionGroup?: string | null; session?: string | null }, allowed: string[]): boolean {
  const selections = allowed.map(normalizeSessionSelection).filter((value): value is string => value !== null);
  if (trade.sessionKey || trade.sessionGroup) {
    const definition = SESSION_DEFINITIONS.find(item => item.key === trade.sessionKey);
    const group = trade.sessionGroup ?? definition?.group;
    return selections.some(value => value === `session:${trade.sessionKey}` || value === `group:${group}`);
  }
  if (!trade.session) return false;
  const legacy = normalizeSessionSelection(trade.session);
  return legacy !== null && selections.includes(legacy);
}
