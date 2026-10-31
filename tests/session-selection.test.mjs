import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { normalizeSessionSelection, normalizeSessionSelections, matchesSessionSelection, SESSION_RULE_OPTIONS } = require("../.tmp-session-selection-tests/session-selection.js");

test("legacy NY and names normalize to stable keys", () => {
  assert.equal(normalizeSessionSelection("NY"), "group:new_york");
  assert.equal(normalizeSessionSelection("Frankfurt"), "session:frankfurt");
  assert.equal(normalizeSessionSelection("London lunch"), "session:london_lunch");
  assert.equal(normalizeSessionSelection("Off hours"), "group:off");
});
test("London group includes each London sub-session", () => {
  for (const key of ["frankfurt", "london", "london_lunch", "london_pm"]) assert.equal(matchesSessionSelection({ sessionKey: key, sessionGroup: "london" }, ["London"]), true);
});
test("exact London selection never broadens through legacy session", () => {
  assert.equal(matchesSessionSelection({ sessionKey: "frankfurt", sessionGroup: "london", session: "London" }, ["London (session)"]), false);
  assert.equal(matchesSessionSelection({ sessionKey: "london", sessionGroup: "london", session: "London" }, ["London (session)"]), true);
});
test("sub-session labels and canonical selections match", () => {
  assert.equal(matchesSessionSelection({ sessionKey: "london_lunch", sessionGroup: "london" }, ["London lunch"]), true);
  assert.equal(matchesSessionSelection({ sessionKey: "london_pm", sessionGroup: "london" }, ["session:london_lunch"]), false);
  assert.equal(matchesSessionSelection({ sessionKey: "off_hours", sessionGroup: "off" }, ["Off hours"]), true);
  assert.equal(matchesSessionSelection({ session: "NY" }, ["New York"]), true);
});
test("invalid and unclassified values do not match", () => {
  assert.equal(matchesSessionSelection({}, ["London"]), false);
  assert.equal(matchesSessionSelection({ sessionKey: "new_york", sessionGroup: "new_york" }, ["London"]), false);
  assert.equal(normalizeSessionSelection("Overlap"), null);
  assert.throws(() => normalizeSessionSelections(["invalid"]));
});
test("normalization removes Overlap and duplicates without replacing with defaults", () => {
  assert.deepEqual(normalizeSessionSelections(["NY", "New York", "Overlap"]), ["group:new_york"]);
  assert.deepEqual(normalizeSessionSelections(["Overlap"]), []);
  assert.deepEqual(normalizeSessionSelections([]), []);
});
test("group and sub-session values and labels are unique", () => {
  assert.equal(new Set(SESSION_RULE_OPTIONS.map(option => option.value)).size, SESSION_RULE_OPTIONS.length);
  assert.equal(new Set(SESSION_RULE_OPTIONS.map(option => option.label)).size, SESSION_RULE_OPTIONS.length);
});
