import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const p = require("../.tmp-picker-value-tests/lib/time/picker-value.js");

test("days are validated against the real calendar", () => {
  assert.equal(p.isPickerDay("2026-11-14"), true);
  assert.equal(p.isPickerDay("2028-02-29"), true);
  assert.equal(p.isPickerDay("2026-02-29"), false);
  assert.equal(p.isPickerDay("2026-13-01"), false);
  assert.equal(p.isPickerDay("14.11.2026"), false);
});

test("times are 24-hour HH:mm", () => {
  assert.equal(p.isPickerTime("00:00"), true);
  assert.equal(p.isPickerTime("23:59"), true);
  assert.equal(p.isPickerTime("24:00"), false);
  assert.equal(p.isPickerTime("9:30"), false);
});

test("date-time values split and join like the native datetime-local input", () => {
  assert.deepEqual(p.splitDateTime("2026-11-14T09:05"), { day: "2026-11-14", time: "09:05" });
  assert.deepEqual(p.splitDateTime("2026-11-14T09:05:30"), { day: "2026-11-14", time: "09:05" });
  assert.deepEqual(p.splitDateTime(""), { day: "", time: "" });
  assert.deepEqual(p.splitDateTime("garbage"), { day: "", time: "" });
  assert.equal(p.joinDateTime("2026-11-14", "09:05"), "2026-11-14T09:05");
  assert.equal(p.joinDateTime("2026-11-14", ""), "2026-11-14T00:00");
  assert.equal(p.joinDateTime("", "09:05"), "");
});

test("time parts round-trip", () => {
  assert.deepEqual(p.splitTime("07:45"), { hour: 7, minute: 45 });
  assert.equal(p.splitTime("7:45"), null);
  assert.equal(p.joinTime(7, 5), "07:05");
});

test("grid dates keep the wall day", () => {
  const date = p.dayToGridDate("2026-03-29");
  assert.equal(p.gridDateToDay(date), "2026-03-29");
  assert.equal(p.dayToGridDate("2026-02-30"), undefined);
});

test("day labels do not drift with the zone", () => {
  assert.equal(p.formatPickerDay("2026-11-14", "en-GB"), "14 Nov 2026");
  assert.equal(p.formatPickerDay("bad", "en-GB"), "");
});
