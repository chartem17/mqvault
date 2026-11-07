import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { screenshotImageUrl, galleryItems, isMistake } = require("../.tmp-screenshot-gallery-tests/lib/journal/screenshot-gallery.js");

test("TradingView snapshot pages map to their PNG; direct images pass; other links do not", () => {
  assert.equal(screenshotImageUrl("https://www.tradingview.com/x/v1XJ69hu/"), "https://s3.tradingview.com/snapshots/v/v1XJ69hu.png");
  assert.equal(screenshotImageUrl(" https://tradingview.com/x/NsD5a8mO "), "https://s3.tradingview.com/snapshots/n/NsD5a8mO.png");
  assert.equal(screenshotImageUrl("https://uk.tradingview.com/x/AbC123/?foo=1"), "https://s3.tradingview.com/snapshots/a/AbC123.png");
  assert.equal(screenshotImageUrl("https://example.com/chart.PNG?x=1"), "https://example.com/chart.PNG?x=1");
  assert.equal(screenshotImageUrl("https://www.tradingview.com/chart/abc/"), null);
  assert.equal(screenshotImageUrl("javascript:alert(1)"), null);
  assert.equal(screenshotImageUrl(""), null);
  assert.equal(screenshotImageUrl(null), null);
});

const shot = id => `https://www.tradingview.com/x/${id}/`;
const trades = [
  { id: "a", opened_at: "2026-10-01T09:00:00Z", symbol: "EURUSD", screenshot_url: shot("Aaa"), result_r: 2.5, setup: "Retest" },
  { id: "b", opened_at: "2026-10-02T09:00:00Z", symbol: "EUR/USD", screenshot_url: shot("Bbb"), result_r: -1, mistake: "Moved stop" },
  { id: "c", opened_at: "2026-10-03T09:00:00Z", symbol: "XAUUSD", screenshot_url: shot("Ccc"), result_r: 0.8, review: { followed_plan: false } },
  { id: "d", opened_at: "2026-10-04T09:00:00Z", symbol: "XAUUSD", screenshot_url: null, result_r: 5 },
  { id: "e", opened_at: "2026-10-05T09:00:00Z", symbol: "GBPUSD", screenshot_url: shot("Eee"), result_r: null },
  { id: "f", opened_at: "2026-10-06T09:00:00Z", symbol: "GBPUSD", screenshot_url: shot("Fff"), result_r: -2.2, setup: "retest" },
];
const ids = items => items.map(item => item.trade.id);

test("presets: all newest first, best/worst by R, mistakes by mark or plan", () => {
  assert.deepEqual(ids(galleryItems(trades, { preset: "all" })), ["f", "e", "c", "b", "a"]);
  assert.deepEqual(ids(galleryItems(trades, { preset: "best" })), ["a", "c"]);
  assert.deepEqual(ids(galleryItems(trades, { preset: "worst" })), ["f", "b"]);
  assert.deepEqual(ids(galleryItems(trades, { preset: "mistakes" })), ["c", "b"]);
  assert.equal(isMistake(trades[0]), false);
});

test("symbol and setup narrow any preset", () => {
  assert.deepEqual(ids(galleryItems(trades, { preset: "all", symbol: "EURUSD" })), ["b", "a"]);
  assert.deepEqual(ids(galleryItems(trades, { preset: "all", setup: "RETEST" })), ["f", "a"]);
  assert.deepEqual(ids(galleryItems(trades, { preset: "worst", setup: "Retest" })), ["f"]);
});
