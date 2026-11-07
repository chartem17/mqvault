import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { dayWindow, fractionOf, sessionSegments } = require("../.tmp-day-dial-tests/lib/dashboard/day-dial.js");
const { greetingFor } = require("../.tmp-home-summary-tests/lib/dashboard/home-summary.js");

test("day window follows the user's zone, including DST days", () => {
  const kyiv = dayWindow("Europe/Kyiv", Date.parse("2026-11-05T22:30:00Z")); // 06.11 in Kyiv
  assert.equal(new Date(kyiv.start).toISOString(), "2026-11-05T22:00:00.000Z");
  assert.equal((kyiv.end - kyiv.start) / 3_600_000, 24);
  const springForward = dayWindow("Europe/Kyiv", Date.parse("2026-03-29T12:00:00Z"));
  assert.equal((springForward.end - springForward.start) / 3_600_000, 23);
  const fallBack = dayWindow("Europe/Kyiv", Date.parse("2026-10-25T12:00:00Z"));
  assert.equal((fallBack.end - fallBack.start) / 3_600_000, 25);
});
test("fraction is null outside the window and monotonic inside", () => {
  const w = dayWindow("UTC", Date.parse("2026-11-05T12:00:00Z"));
  assert.equal(fractionOf(w.start, w), 0); assert.equal(fractionOf(Date.parse("2026-11-05T12:00:00Z"), w), 0.5);
  assert.equal(fractionOf(w.end, w), null); assert.equal(fractionOf(w.start - 1, w), null); assert.equal(fractionOf(NaN, w), null);
});
test("segments are contiguous, cover the whole day and match the session clock", () => {
  const w = dayWindow("Europe/Kyiv", Date.parse("2026-11-05T12:00:00Z"));
  const segments = sessionSegments(w);
  assert.equal(segments[0].from, 0); assert.equal(segments[segments.length - 1].to, 1);
  for (let i = 1; i < segments.length; i++) { assert.equal(segments[i].from, segments[i - 1].to); assert.notEqual(segments[i].group, segments[i - 1].group); }
  const groupAt = iso => { const f = fractionOf(Date.parse(iso), w); return segments.find(s => f >= s.from && f < s.to).group; };
  assert.equal(groupAt("2026-11-05T11:00:00Z"), "london");
  assert.equal(groupAt("2026-11-05T17:00:00Z"), "new_york");
});
test("greetings follow the hour (English source, translated in the UI)", () => {
  assert.deepEqual([3, 8, 14, 20].map(greetingFor), ["Good night", "Good morning", "Good afternoon", "Good evening"]);
});
