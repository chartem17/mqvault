import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const tz = require("../.tmp-timezone-tests/timezone.js");

test("typed wall time is read in the given zone and stored as UTC", () => {
  // Kyiv winter UTC+2, summer UTC+3
  assert.equal(tz.fromZonedInputValue("2026-01-15T14:10", "Europe/Kyiv"), "2026-01-15T12:10:00.000Z");
  assert.equal(tz.fromZonedInputValue("2026-06-08T14:10", "Europe/Kyiv"), "2026-06-08T11:10:00.000Z");
  assert.equal(tz.fromZonedInputValue("2026-06-08T14:10", "UTC"), "2026-06-08T14:10:00.000Z");
  assert.equal(tz.fromZonedInputValue("2026-06-08T08:00", "America/New_York"), "2026-06-08T12:00:00.000Z");
  assert.equal(tz.fromZonedInputValue("2026-06-08T14:10", "Etc/GMT-3"), "2026-06-08T11:10:00.000Z");
});
test("stored instant round-trips through the input value of any zone", () => {
  for (const zone of ["Europe/Kyiv", "UTC", "America/New_York", "Asia/Tokyo", "Australia/Sydney"]) {
    for (const iso of ["2026-01-15T12:10:00.000Z", "2026-06-08T11:18:00.000Z", "2026-03-29T00:30:00.000Z"]) {
      assert.equal(tz.fromZonedInputValue(tz.toZonedInputValue(iso, zone), zone), iso, `${zone} ${iso}`);
    }
  }
});
test("empty and invalid inputs give empty values instead of shifted dates", () => {
  assert.equal(tz.fromZonedInputValue("", "Europe/Kyiv"), "");
  assert.equal(tz.fromZonedInputValue("not a date", "Europe/Kyiv"), "");
  assert.equal(tz.toZonedInputValue(null, "Europe/Kyiv"), "");
  assert.equal(tz.toZonedInputValue("invalid", "Europe/Kyiv"), "");
  assert.equal(tz.formatDateTimeOrDash(null, "Europe/Kyiv"), "—");
});
test("a non-existent spring-forward time resolves to the first valid minute after the gap", () => {
  // Kyiv 2026-03-29 03:00 → 04:00 local; 03:30 does not exist
  assert.equal(tz.fromZonedInputValue("2026-03-29T03:30", "Europe/Kyiv"), "2026-03-29T01:00:00.000Z");
});
test("day and month keys follow the user's zone", () => {
  const iso = "2026-07-31T22:30:00Z";
  assert.equal(tz.dayKey(iso, "Europe/Kyiv"), "2026-08-01");
  assert.equal(tz.monthKey(iso, "Europe/Kyiv"), "2026-08");
  assert.equal(tz.dayKey(iso, "America/New_York"), "2026-07-31");
  assert.equal(tz.monthKey(iso, "America/New_York"), "2026-07");
  assert.equal(tz.timeLabel(iso, "Asia/Tokyo"), "07:30");
  assert.equal(tz.startOfZonedDay("2026-08-01", "Europe/Kyiv"), Date.parse("2026-07-31T21:00:00Z"));
});
test("zone validation", () => {
  assert.equal(tz.isValidTimeZone("Europe/Kyiv"), true);
  assert.equal(tz.isValidTimeZone("Mars/Base"), false);
  assert.equal(tz.isValidTimeZone(""), false);
});
