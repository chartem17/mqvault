import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { summarizeToday, dailyLossRoom, lastDays, unmarkedTrades } = require("../.tmp-home-summary-tests/lib/dashboard/home-summary.js");
const t = (id, opened_at, closed_at, net_pnl, extra = {}) => ({ id, account_id: "a", symbol: "EURUSD", direction: "Long", opened_at, closed_at, net_pnl, ...extra });
const now = new Date("2026-11-05T22:30:00Z"); // 06.11 00:30 in Kyiv, still 05.11 in UTC

test("today follows the user's zone", () => {
  const trades = [t("1", "2026-11-05T22:10:00Z", "2026-11-05T22:20:00Z", -20), t("2", "2026-11-05T10:00:00Z", "2026-11-05T11:00:00Z", 50)];
  const kyiv = summarizeToday(trades, "Europe/Kyiv", now);
  assert.equal(kyiv.day, "2026-11-06"); assert.equal(kyiv.opened, 1); assert.equal(kyiv.closedCount, 1); assert.equal(kyiv.netPnl, -20); assert.equal(kyiv.losses, 1);
  const utc = summarizeToday(trades, "UTC", now);
  assert.equal(utc.day, "2026-11-05"); assert.equal(utc.opened, 2); assert.equal(utc.netPnl, 30); assert.equal(utc.wins, 1);
});
test("missing pnl makes the sum unknown, open trades are not realised", () => {
  const trades = [t("1", "2026-11-05T10:00:00Z", "2026-11-05T11:00:00Z", null), t("2", "2026-11-05T12:00:00Z", null, null)];
  const s = summarizeToday(trades, "UTC", now);
  assert.equal(s.netPnl, null); assert.equal(s.opened, 2); assert.equal(s.closedCount, 1);
});
test("daily loss room only from explicit inputs and never above the limit", () => {
  assert.deepEqual(dailyLossRoom(5000, 4, -50), { limit: 200, room: 150 });
  assert.deepEqual(dailyLossRoom(5000, 4, 120), { limit: 200, room: 200 });
  assert.deepEqual(dailyLossRoom(5000, 4, -999), { limit: 200, room: 0 });
  for (const args of [[null, 4, 0], [5000, null, 0], [5000, 4, null], [0, 4, 0]]) assert.equal(dailyLossRoom(...args), null);
});
test("last days fills empty days and orders oldest first", () => {
  const trades = [t("1", "2026-11-04T10:00:00Z", "2026-11-04T11:00:00Z", 10), t("2", "2026-11-05T10:00:00Z", "2026-11-05T11:00:00Z", -4), t("3", "2026-11-05T12:00:00Z", "2026-11-05T13:00:00Z", 1)];
  const days = lastDays(trades, "UTC", 3, now);
  assert.deepEqual(days, [{ day: "2026-11-03", net: 0, count: 0 }, { day: "2026-11-04", net: 10, count: 1 }, { day: "2026-11-05", net: -3, count: 2 }]);
});
test("unmarked trades miss setup or emotion", () => {
  const list = [t("1", "x", null, 1, { setup: "A", emotion: "Calm" }), t("2", "x", null, 1, { setup: "A" }), t("3", "x", null, 1, { setup: " ", emotion: "Calm" })];
  assert.deepEqual(unmarkedTrades(list).map(x => x.id), ["2", "3"]);
});
