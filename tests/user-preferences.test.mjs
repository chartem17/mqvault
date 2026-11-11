import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { sanitizePreferences, mergePreferences, DEFAULT_PREFERENCES } = require("../.tmp-user-preferences-tests/lib/preferences/user-preferences.js");

test("garbage and unknown keys fall back to defaults", () => {
  for (const bad of [null, undefined, 42, "x", [], { __proto__: { privacy: true } }]) assert.deepEqual(sanitizePreferences(bad), DEFAULT_PREFERENCES);
  const result = sanitizePreferences({ startTab: "market", privacy: "yes", weekStart: 5, numberFormat: "roman", defaultAccountId: "not-a-uuid", defaultRiskPercent: 500, evil: 1 });
  assert.deepEqual(result, DEFAULT_PREFERENCES);
  assert.equal("evil" in result, false);
});

test("valid values are kept and normalised", () => {
  const result = sanitizePreferences({
    startTab: "journal", privacy: true, weekStart: 0, numberFormat: "european",
    defaultAccountId: "0000AAAA-0000-4000-8000-000000000001", defaultRiskPercent: 0.505,
    goals: { month: "2026-11", targetR: 10, maxRedDays: 4.6, reviewShare: 90 },
    checklist: { day: "2026-11-11", plan: "Only A+ setups", checked: ["r1", "r1", 7, "r2"] },
    onboardingDismissed: true, reviewReminder: false,
  });
  assert.equal(result.startTab, "journal");
  assert.equal(result.weekStart, 0);
  assert.equal(result.defaultAccountId, "0000aaaa-0000-4000-8000-000000000001");
  assert.equal(result.defaultRiskPercent, 0.51);
  assert.deepEqual(result.goals, { month: "2026-11", targetR: 10, maxRedDays: 5, reviewShare: 90 });
  assert.deepEqual(result.checklist, { day: "2026-11-11", plan: "Only A+ setups", checked: ["r1", "r2"] });
  assert.equal(result.reviewReminder, false);
});

test("goals and checklist with a bad date are dropped; long text is cut", () => {
  const result = sanitizePreferences({ goals: { month: "2026-13", targetR: 5 }, checklist: { day: "2026-02-30x", plan: "a" } });
  assert.equal(result.goals, null);
  assert.equal(result.checklist, null);
  assert.equal(sanitizePreferences({ goals: { month: "2026-11" } }).goals, null, "a month without any target is no goal");
  assert.equal(sanitizePreferences({ checklist: { day: "2026-11-11", plan: "x".repeat(5000) } }).checklist.plan.length, 2000);
});

test("merge takes only known keys", () => {
  const merged = mergePreferences(DEFAULT_PREFERENCES, { privacy: true, isOwner: true, plan: "pro" });
  assert.equal(merged.privacy, true);
  assert.equal("isOwner" in merged, false);
  assert.equal(mergePreferences(merged, { privacy: false }).privacy, false);
});
