import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { SESSION_DEFINITIONS, getSessionKey, getSessionGroup, getSessionBounds, getSessionDisplay } = require("../.tmp-session-tests/sessions.js");

test("all exact boundaries use start-inclusive and end-exclusive intervals", () => {
  const next = { asia: "frankfurt", frankfurt: "london", london: "london_lunch", london_lunch: "london_pm", london_pm: "new_york", new_york: "off_hours", off_hours: "asia" };
  for (const day of ["2026-01-15", "2026-07-15", "2026-03-29", "2026-10-25"]) {
    for (const session of SESSION_DEFINITIONS) {
      const bounds = getSessionBounds(session.key, day);
      assert.equal(getSessionKey(bounds.startAt), session.key);
      assert.equal(getSessionKey(new Date(Date.parse(bounds.endAt) - 1)), session.key);
      assert.equal(getSessionKey(bounds.endAt), next[session.key]);
      assert.ok(Date.parse(bounds.endAt) > Date.parse(bounds.startAt));
    }
  }
});
test("Warsaw boundaries are converted for both winter and summer", () => {
  for (const timestamp of ["2026-01-15T08:00:00Z", "2026-07-15T07:00:00Z"]) {
    assert.equal(getSessionDisplay(timestamp, "Europe/Kyiv").start, "10:00");
    assert.equal(getSessionDisplay(timestamp, "Europe/Warsaw").start, "09:00");
  }
});
test("display timezone does not reclassify a trade", () => {
  const timestamp = "2026-07-15T13:00:00Z";
  for (const zone of ["Europe/Kyiv", "Europe/Warsaw", "UTC", "Asia/Tokyo", "America/New_York"]) assert.equal(getSessionDisplay(timestamp, zone).key, "new_york");
  assert.equal(getSessionGroup("2026-07-15T06:30:00Z"), "london");
});
test("cross-midnight labels and overnight source dates are retained", () => {
  const tokyo = getSessionDisplay("2026-07-15T13:00:00Z", "Asia/Tokyo");
  assert.equal(tokyo.start, "21:00"); assert.equal(tokyo.end, "05:00"); assert.equal(tokyo.dayOffset, 1);
  const overnight = getSessionDisplay("2026-01-15T22:30:00Z");
  assert.equal(overnight.key, "off_hours"); assert.equal(overnight.sourceDate, "2026-01-15"); assert.equal(overnight.endDate, "2026-01-16");
});
test("there is no Overlap option and invalid values fail explicitly", () => {
  assert.equal(SESSION_DEFINITIONS.some(session => session.key.toLowerCase() === "overlap"), false);
  assert.throws(() => getSessionBounds("Overlap", "2026-07-15"), RangeError);
  assert.throws(() => getSessionDisplay("invalid"), RangeError);
  assert.throws(() => getSessionDisplay("2026-07-15T13:00:00Z", "invalid/timezone"), RangeError);
  assert.throws(() => getSessionBounds("london", "2026-02-31"), RangeError);
});
