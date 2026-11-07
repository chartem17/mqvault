import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { SESSION_DEFINITIONS, getSessionKey, getSessionGroup, getSessionBounds, getSessionDisplay } = require("../.tmp-session-tests/lib/time/sessions.js");

test("all exact boundaries use start-inclusive and end-exclusive intervals", () => {
  const next = { asia: "frankfurt", frankfurt: "london", london: "london_lunch", london_lunch: "london_pm", london_pm: "new_york", new_york: "off_hours", off_hours: "asia" };
  for (const day of ["2026-01-15", "2026-07-15", "2026-03-29", "2026-10-25", "2026-03-15"]) {
    for (const session of SESSION_DEFINITIONS) {
      const bounds = getSessionBounds(session.key, day);
      if (bounds.startAt === bounds.endAt) { assert.equal(session.key, "london_pm"); continue; } // overtaken by New York in DST-mismatch weeks
      assert.equal(getSessionKey(bounds.startAt), session.key);
      assert.equal(getSessionKey(new Date(Date.parse(bounds.endAt) - 1)), session.key);
      const following = getSessionKey(bounds.endAt);
      // In DST-mismatch weeks London after lunch is overtaken, so lunch hands over straight to New York.
      assert.ok(following === next[session.key] || (session.key === "london_lunch" && following === "new_york"), `${day} ${session.key} -> ${following}`);
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

test("sessions follow each market's own clock, matching Kyiv boundaries outside DST-mismatch weeks", () => {
  // Winter (EET / GMT / EST) and summer (EEST / BST / EDT): Kyiv 10:00 London, 15:00 New York, 23:00 Off, 01:00 Asia.
  for (const [kyivOffset, day] of [[2, "2026-01-15"], [3, "2026-07-15"]]) {
    const at = (hour) => new Date(Date.parse(`${day}T${String(hour).padStart(2, "0")}:00:00Z`) - kyivOffset * 3600000);
    assert.equal(getSessionKey(at(9)), "frankfurt");
    assert.equal(getSessionKey(at(10)), "london");
    assert.equal(getSessionKey(at(12)), "london_lunch");
    assert.equal(getSessionKey(at(14)), "london_pm");
    assert.equal(getSessionKey(at(15)), "new_york");
    assert.equal(getSessionKey(at(23)), "off_hours");
    assert.equal(getSessionKey(at(8)), "asia");
  }
});
test("New York opens at 08:00 New York time during DST-mismatch weeks", () => {
  // 2026-03-16: US already on EDT (UTC-4), Europe still on GMT/EET.
  assert.equal(getSessionKey("2026-03-16T12:00:00Z"), "new_york"); // 08:00 New York, 12:00 London
  assert.equal(getSessionKey("2026-03-16T11:59:00Z"), "london_lunch");
  assert.equal(getSessionKey("2026-03-16T20:00:00Z"), "off_hours"); // 16:00 New York
  assert.equal(getSessionKey("2026-03-24T22:08:00Z"), "asia"); // 18:08 New York, after rollover
  // 2026-10-27: Europe back on GMT, US still on EDT.
  assert.equal(getSessionKey("2026-10-27T12:00:00Z"), "new_york");
});
test("session display is shown in the viewer's zone without changing the session", () => {
  const ny = getSessionDisplay("2026-07-15T13:00:00Z", "America/Los_Angeles");
  assert.equal(ny.key, "new_york"); assert.equal(ny.start, "05:00"); assert.equal(ny.end, "13:00");
  const utc = getSessionDisplay("2026-01-15T08:30:00Z", "UTC");
  assert.equal(utc.key, "london"); assert.equal(utc.start, "08:00"); assert.equal(utc.end, "10:00");
});
