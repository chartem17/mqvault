import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { MARKET_WATCHLIST, ALL_SYMBOLS } = require("../.tmp-market-tests/market-watchlist.js");
const { MARKET_INSTRUMENTS } = require("../.tmp-market-tests/instruments.js");
const { markQuotesStale } = require("../.tmp-market-tests/market-stale.js");

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "NZD", "CAD", "CHF"];

test("market watchlist has no stocks or energy equities", () => {
  assert.equal(MARKET_WATCHLIST.filter((item) => item.assetClass === "stock").length, 0);
  for (const symbol of ["AAPL", "TSLA", "XOM", "XLE", "COP", "CVX", "SLB"]) assert.ok(!ALL_SYMBOLS.includes(symbol), symbol);
});

test("market watchlist has exactly the 28 forex pairs of the eight majors", () => {
  const forex = MARKET_WATCHLIST.filter((item) => item.assetClass === "forex");
  assert.equal(forex.length, 28);
  assert.equal(new Set(forex.map((item) => item.symbol)).size, 28);
  for (const item of forex) {
    assert.ok(CURRENCIES.includes(item.symbol.slice(0, 3)), item.symbol);
    assert.ok(CURRENCIES.includes(item.symbol.slice(3, 6)), item.symbol);
  }
  for (const symbol of ["USDMXN", "USDTRY", "USDZAR", "USDCNH"]) assert.ok(!ALL_SYMBOLS.includes(symbol), symbol);
});

test("market watchlist keeps crypto, metals, commodities and indices", () => {
  for (const symbol of ["BTCUSDT", "XAUUSD", "WTIUSD", "US500"]) assert.ok(ALL_SYMBOLS.includes(symbol), symbol);
  assert.equal(new Set(ALL_SYMBOLS).size, ALL_SYMBOLS.length);
});

test("shared catalog used by the journal still contains stocks and exotics", () => {
  const symbols = MARKET_INSTRUMENTS.map((item) => item.symbol);
  for (const symbol of ["AAPL", "XOM", "USDMXN", "USDTRY"]) assert.ok(symbols.includes(symbol), symbol);
});

test("stale marking flags priced quotes and keeps priced data", () => {
  const input = [{ symbol: "EURUSD", price: 1.1, updatedAt: 5 }, { symbol: "GBPUSD", price: null, error: "no quote" }];
  const output = markQuotesStale(input, "HTTP 429");
  assert.equal(output[0].stale, true);
  assert.equal(output[0].error, "HTTP 429");
  assert.equal(output[0].price, 1.1);
  assert.equal(output[0].updatedAt, 5);
  assert.equal(output[1].stale, undefined);
  assert.equal(output[1].error, "no quote");
  assert.equal(input[0].stale, undefined, "input must not be mutated");
});
