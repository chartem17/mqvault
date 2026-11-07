import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { sessionStatus, isForexWeekend } = require("../.tmp-session-status-tests/lib/dashboard/session-status.js");
const at = iso => new Date(iso);

test("forex weekend runs from Friday 17:00 to Sunday 17:00 New York", () => {
  assert.equal(isForexWeekend(Date.parse("2026-11-13T21:59:00Z")), false); // Fri 16:59 NY
  assert.equal(isForexWeekend(Date.parse("2026-11-13T22:00:00Z")), true); // Fri 17:00 NY
  assert.equal(isForexWeekend(Date.parse("2026-11-07T12:00:00Z")), true); // Saturday
  assert.equal(isForexWeekend(Date.parse("2026-11-08T21:59:00Z")), true); // Sun 16:59 NY
  assert.equal(isForexWeekend(Date.parse("2026-11-08T22:00:00Z")), false); // Sun 17:00 NY
});

test("on the weekend no session runs; the week and the next allowed session are named", () => {
  const free = sessionStatus(at("2026-11-07T12:00:00Z"), null);
  assert.equal(free.closed, true); assert.equal(free.current, null); assert.equal(free.opensAt, "2026-11-08T22:00:00.000Z"); assert.equal(free.nextAllowed, null);
  const london = sessionStatus(at("2026-11-07T12:00:00Z"), ["London"]);
  assert.equal(london.nextAllowed.key, "frankfurt"); assert.equal(london.nextAllowed.startsAt, "2026-11-09T07:00:00.000Z");
});

test("current session against the strategy's allowed sessions", () => {
  const none = sessionStatus(at("2026-11-10T03:00:00Z"), null);
  assert.equal(none.current.key, "asia"); assert.equal(none.allowed, null); assert.equal(none.current.endsAt, "2026-11-10T07:00:00.000Z");
  const asia = sessionStatus(at("2026-11-10T03:00:00Z"), ["London", "New York"]);
  assert.equal(asia.allowed, false); assert.equal(asia.nextAllowed.key, "frankfurt"); assert.equal(asia.nextAllowed.startsAt, "2026-11-10T07:00:00.000Z");
  const lunch = sessionStatus(at("2026-11-10T10:30:00Z"), ["London"]);
  assert.equal(lunch.current.key, "london_lunch"); assert.equal(lunch.allowed, true); assert.equal(lunch.nextAllowed, null);
});

test("an exact sub-session only allows itself and the next one is found a day later", () => {
  const status = sessionStatus(at("2026-11-10T10:30:00Z"), ["London (session)"]);
  assert.equal(status.allowed, false);
  assert.equal(status.nextAllowed.key, "london"); assert.equal(status.nextAllowed.startsAt, "2026-11-11T08:00:00.000Z");
});

test("Friday evening: the next allowed session is after the weekend", () => {
  const status = sessionStatus(at("2026-11-13T21:30:00Z"), ["New York"]); // Fri 16:30 NY, off hours
  assert.equal(status.allowed, false); assert.equal(status.nextAllowed.key, "new_york"); assert.equal(status.nextAllowed.startsAt, "2026-11-16T13:00:00.000Z");
});

test("the week reopens exactly at Sunday 17:00 New York", () => {
  const { weekOpen } = require("../.tmp-session-status-tests/lib/dashboard/session-status.js");
  assert.equal(new Date(weekOpen(Date.parse("2026-11-07T12:03:17Z"))).toISOString(), "2026-11-08T22:00:00.000Z");
  assert.equal(new Date(weekOpen(Date.parse("2026-11-13T22:07:00Z"))).toISOString(), "2026-11-15T22:00:00.000Z");
  assert.equal(new Date(weekOpen(Date.parse("2026-11-08T21:00:00Z"))).toISOString(), "2026-11-08T22:00:00.000Z");
});
