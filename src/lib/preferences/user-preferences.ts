/**
 * Per-user settings kept on the server (app_users.preferences, migration 20261112194420) with a copy in the
 * browser. Pure: every value coming from storage or a request goes through `sanitizePreferences`, so a bad or
 * old value can never break the UI and unknown keys are dropped.
 */

export const START_TABS = ["home", "overview", "journal", "strategy-control", "calendar"] as const;
export type StartTab = typeof START_TABS[number];
export const NUMBER_FORMATS = ["plain", "grouped", "european"] as const;
export type NumberFormat = typeof NUMBER_FORMATS[number];

export type MonthlyGoals = { month: string; targetR: number | null; maxRedDays: number | null; reviewShare: number | null };
export type Checklist = { day: string; plan: string; checked: string[] };

export type UserPreferences = {
  startTab: StartTab;
  /** Hide money amounts (screenshots, streams). */
  privacy: boolean;
  /** First day of the week in calendar grids: 1 = Monday, 0 = Sunday. */
  weekStart: 0 | 1;
  numberFormat: NumberFormat;
  defaultAccountId: string | null;
  defaultRiskPercent: number | null;
  goals: MonthlyGoals | null;
  checklist: Checklist | null;
  onboardingDismissed: boolean;
  reviewReminder: boolean;
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  startTab: "home", privacy: false, weekStart: 1, numberFormat: "plain", defaultAccountId: null, defaultRiskPercent: null,
  goals: null, checklist: null, onboardingDismissed: false, reviewReminder: true,
};

/** Stored size limit, mirrored by the database check. */
export const MAX_PREFERENCES_BYTES = 16384;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Own enumerable keys only: nothing inherited through a prototype (`{"__proto__": {...}}`) is ever read. */
const record = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value as object)) : null;
function numberIn(value: unknown, min: number, max: number, digits = 2): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}
function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\u0000/g, "").slice(0, max) : "";
}

function goals(value: unknown): MonthlyGoals | null {
  const input = record(value);
  if (!input || typeof input.month !== "string" || !MONTH.test(input.month)) return null;
  const result = { month: input.month, targetR: numberIn(input.targetR, -1000, 1000), maxRedDays: numberIn(input.maxRedDays, 0, 31, 0), reviewShare: numberIn(input.reviewShare, 0, 100, 0) };
  return result.targetR === null && result.maxRedDays === null && result.reviewShare === null ? null : result;
}

function checklist(value: unknown): Checklist | null {
  const input = record(value);
  if (!input || typeof input.day !== "string" || !DAY.test(input.day)) return null;
  const checked = Array.isArray(input.checked) ? [...new Set(input.checked.filter((item): item is string => typeof item === "string").map(item => item.slice(0, 80)))].slice(0, 40) : [];
  return { day: input.day, plan: text(input.plan, 2000), checked };
}

export function sanitizePreferences(value: unknown): UserPreferences {
  const input = record(value) ?? {};
  return {
    startTab: START_TABS.includes(input.startTab as StartTab) ? input.startTab as StartTab : DEFAULT_PREFERENCES.startTab,
    privacy: input.privacy === true,
    weekStart: input.weekStart === 0 ? 0 : 1,
    numberFormat: NUMBER_FORMATS.includes(input.numberFormat as NumberFormat) ? input.numberFormat as NumberFormat : "plain",
    defaultAccountId: typeof input.defaultAccountId === "string" && UUID.test(input.defaultAccountId) ? input.defaultAccountId.toLowerCase() : null,
    defaultRiskPercent: numberIn(input.defaultRiskPercent, 0.01, 100),
    goals: goals(input.goals),
    checklist: checklist(input.checklist),
    onboardingDismissed: input.onboardingDismissed === true,
    reviewReminder: input.reviewReminder !== false,
  };
}

/** Applies a partial update. Only known keys are taken from the patch; the result is sanitized again. */
export function mergePreferences(current: UserPreferences, patch: unknown): UserPreferences {
  const input = record(patch) ?? {};
  const known = Object.fromEntries(Object.entries(input).filter(([key]) => key in DEFAULT_PREFERENCES));
  return sanitizePreferences({ ...current, ...known });
}
