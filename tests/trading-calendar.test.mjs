import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { calendarCellKey, kyivDayOrNull, kyivMonthCursor, isInKyivPeriod, defaultKyivPeriod } = require("../.tmp-date-tests/trading-calendar.js");

test("Kyiv day crosses UTC midnight correctly in winter and summer", () => {
  assert.equal(kyivDayOrNull("2026-01-15T21:59:59Z"), "2026-01-15");
  assert.equal(kyivDayOrNull("2026-01-15T22:00:00Z"), "2026-01-16");
  assert.equal(kyivDayOrNull("2026-07-15T20:59:59Z"), "2026-07-15");
  assert.equal(kyivDayOrNull("2026-07-15T21:00:00Z"), "2026-07-16");
});
test("period boundaries include both complete Kyiv dates", () => {
  const period = { start: "2026-07-16", end: "2026-07-16" };
  assert.equal(isInKyivPeriod("2026-07-15T20:59:59Z", period), false);
  assert.equal(isInKyivPeriod("2026-07-15T21:00:00Z", period), true);
  assert.equal(isInKyivPeriod("2026-07-16T20:59:59Z", period), true);
  assert.equal(isInKyivPeriod("2026-07-16T21:00:00Z", period), false);
});
test("invalid dates and reversed ranges fail closed", () => {
  assert.equal(kyivDayOrNull("invalid"), null);
  for (const period of [{ start: "", end: "2026-01-01" }, { start: "2026-02-31", end: "2026-03-02" }, { start: "2026-02-02", end: "2026-02-01" }]) assert.equal(isInKyivPeriod("2026-02-01T12:00:00Z", period), false);
});
test("month subtraction clamps to last valid day", () => {
  assert.deepEqual(defaultKyivPeriod(1, new Date("2026-03-31T12:00:00Z")), { start: "2026-02-28", end: "2026-03-31" });
});
test("calendar cells never shift through UTC serialization", () => {
  for (const zone of ["UTC", "Europe/Kyiv", "Europe/Warsaw", "Asia/Tokyo", "America/Los_Angeles"]) {
    const code = 'const { calendarCellKey } = require("./.tmp-date-tests/trading-calendar.js"); process.stdout.write(calendarCellKey(new Date(2026, 6, 16, 12)));';
    assert.equal(execFileSync(process.execPath, ["-e", code], { env: { ...process.env, TZ: zone }, encoding: "utf8" }), "2026-07-16");
  }
  assert.equal(calendarCellKey(new Date(2026, 6, 16)), "2026-07-16");
});
test("initial month follows Kyiv rather than browser day", () => {
  const cursor = kyivMonthCursor(new Date("2026-01-31T22:30:00Z"));
  assert.equal(cursor.getFullYear(), 2026);
  assert.equal(cursor.getMonth(), 1);
  assert.equal(cursor.getDate(), 1);
});
test("both components use the tested date helpers", () => {
  const strategy = readFileSync("src/components/tabs/strategy-control-tab.tsx", "utf8");
  const overview = readFileSync("src/components/tabs/overview-tab.tsx", "utf8");
  assert.match(strategy, /isInKyivPeriod\(trade.opened_at, period\)/);
  assert.doesNotMatch(strategy, /trade.opened_at.slice\(0, 10\)/);
  assert.match(overview, /calendarCellKey\(date\)/);
  assert.match(overview, /kyivDayOrNull\(trade.opened_at\)/);
  assert.doesNotMatch(overview, /key: date.toISOString\(\).slice\(0, 10\)/);
});
