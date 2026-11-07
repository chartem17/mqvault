import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const m = require("../.tmp-csv-import-tests/lib/journal/csv-import.js");

const load = (text, timezone = "UTC") => {
  const [headers, ...rows] = m.parseCsv(text);
  const mapping = m.detectColumns(headers, rows.slice(0, 50));
  const { order, ambiguous } = m.dateOrderFor(rows, mapping);
  return { headers, mapping, ambiguous, results: m.rowsToTrades(rows, mapping, { timezone, dateOrder: order }) };
};

test("CSV parsing: delimiters, quotes, BOM, CRLF, blank lines", () => {
  assert.equal(m.detectDelimiter("a;b;c\n1;2;3"), ";");
  assert.equal(m.detectDelimiter("a\tb\n1\t2"), "\t");
  assert.deepEqual(m.parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n\r\n1,2'), [["a", "b"], ["x, y", 'say "hi"'], ["1", "2"]]);
  assert.deepEqual(m.parseCsv('n;v\n"multi\nline";5'), [["n", "v"], ["multi\nline", "5"]]);
});

test("numbers, directions and yes/no in many spellings", () => {
  assert.equal(m.parseNumber("1 234,56"), 1234.56);
  assert.equal(m.parseNumber("1,234.56"), 1234.56);
  assert.equal(m.parseNumber("1.234,5"), 1234.5);
  assert.equal(m.parseNumber("$-12.5"), -12.5);
  assert.equal(m.parseNumber("(12.50)"), -12.5);
  assert.equal(m.parseNumber("−4,5"), -4.5);
  assert.equal(m.parseNumber("3%"), 3);
  assert.equal(m.parseNumber("1,500"), 1500);
  assert.equal(m.parseNumber("0,57"), 0.57);
  assert.equal(m.parseNumber(""), null);
  assert.equal(m.parseNumber("n/a"), null);
  for (const v of ["Buy", "buy limit", "LONG", "b"]) assert.equal(m.parseDirection(v), "Long");
  for (const v of ["Sell", "sell stop", "short", "S"]) assert.equal(m.parseDirection(v), "Short");
  assert.equal(m.parseDirection("Continuation"), null);
  assert.equal(m.parseYesNo("Yes"), true); assert.equal(m.parseYesNo("no"), false); assert.equal(m.parseYesNo("maybe"), null);
});

test("dates: MT5, ISO, day/month order from the data, broker zone", () => {
  assert.deepEqual(m.parseDateParts("2026.08.25 17:50:31", "dmy"), { y: 2026, m: 8, d: 25, hh: 17, mm: 50, ss: 31, hasTime: true });
  assert.deepEqual(m.parseDateParts("25.08.2026", "dmy"), { y: 2026, m: 8, d: 25, hh: 0, mm: 0, ss: 0, hasTime: false });
  assert.deepEqual(m.parseDateParts("03/10/2025 5:07 PM", "mdy"), { y: 2025, m: 3, d: 10, hh: 17, mm: 7, ss: 0, hasTime: true });
  assert.equal(m.parseDateParts("31/31/2025", "dmy"), null);
  assert.equal(m.detectDateOrder(["10/03/2025", "25/03/2025"]), "dmy");
  assert.equal(m.detectDateOrder(["03/25/2025"]), "mdy");
  assert.equal(m.detectDateOrder(["10/03/2025"]), "ambiguous");
});

test("own export: snake_case headers, net derived back to gross, broker zone applied", () => {
  const csv = "symbol,side,open_at,entry_price,close_at,exit_price,tp,sl,lots,commission_usd,profit_usd,market,session,swap_usd,emotion,entry_criteria,notes,net_pnl_usd\n" +
    "EURUSD,Buy,2026-08-25 17:50,1.16723,2026-08-25 17:56,1.16669,1.16872,1.16669,0.9,-4.5,-53.1,forex,New York,,,,,-57.6\n" +
    "NZDUSD,Buy,2026-08-25 04:23,0.59594,2026-08-25 10:33,0.59507,,0.59507,0.57,-2.85,-52.44,forex,Asia,,Calm,,late,-55.29";
  const { mapping, results } = load(csv, "Europe/Athens");
  assert.deepEqual(mapping, ["symbol", "direction", "opened_at", "entry_price", "closed_at", "exit_price", "take_profit", "stop_loss", "volume", "commission", "gross_pnl", "market", null, "swap", "emotion", "entry_reason", "notes", "net_pnl"]);
  const [a, b] = results.map(r => r.trade);
  assert.equal(a.symbol, "EURUSD"); assert.equal(a.direction, "Long");
  assert.equal(a.opened_at, "2026-08-25T14:50:00.000Z"); // 17:50 in Athens (EEST, UTC+3)
  assert.equal(a.gross_pnl, -53.1); assert.equal(a.commission, -4.5); assert.equal(a.take_profit, 1.16872); assert.equal(a.volume, 0.9);
  assert.equal(b.take_profit, null); assert.equal(b.emotion, "Calm");
  assert.deepEqual(results.map(r => r.errors), [[], []]);
});

test("hand-made journal: Type is not the direction, Position is; date-only rows", () => {
  const csv = "Trade,Date,Day of Week,Sessions,Pair,HTF P_,LTF E_,Setup,Type,Position,Risk,RR,Follow Rules,Win?,Profit,PnL %\n" +
    "8,10/03/2025,Monday,New York,BTCUSD,LIQ,IDM,Orderflow,Continuation,Long,1%,3%,Yes,Yes,1500.0,3%\n" +
    "6,10/03/2025,Monday,London,BTCUSD,OB,OB,FVG,Reversal,Long,1%,3%,No,No,-500.0,-1%";
  const { mapping, ambiguous, results } = load(csv);
  assert.equal(mapping[mapping.indexOf("direction")], "direction");
  assert.equal(mapping.indexOf("direction"), 9);
  assert.equal(mapping[8], null);
  assert.equal(mapping[1], "opened_at"); assert.equal(mapping[4], "symbol"); assert.equal(mapping[7], "setup");
  assert.equal(mapping[10], "risk_percent"); assert.equal(mapping[12], "followed_plan"); assert.equal(mapping[14], "gross_pnl");
  assert.equal(ambiguous, true);
  const [first, second] = results.map(r => r.trade);
  assert.equal(first.opened_at, "2025-03-10T00:00:00.000Z"); // day-first by default
  assert.equal(first.risk_percent, 1); assert.equal(first.followed_plan, true); assert.equal(second.followed_plan, false);
  assert.equal(second.gross_pnl, -500); assert.equal(first.setup, "Orderflow");
});

test("MT5 positions layout: repeated Time/Price, numeric Position is the ticket", () => {
  const csv = "Time;Position;Symbol;Type;Volume;Price;S / L;T / P;Time;Price;Commission;Swap;Profit\n" +
    "2026.08.25 17:50:12;123456789;EURUSD;buy;0.9;1.16723;1.16669;1.16872;2026.08.25 17:56:40;1.16669;-4.50;0.00;-53.10";
  const { mapping, results } = load(csv, "Europe/Athens");
  assert.deepEqual(mapping, ["opened_at", "external_id", "symbol", "direction", "volume", "entry_price", "stop_loss", "take_profit", "closed_at", "exit_price", "commission", "swap", "gross_pnl"]);
  const trade = results[0].trade;
  assert.equal(trade.opened_at, "2026-08-25T14:50:12.000Z"); assert.equal(trade.closed_at, "2026-08-25T14:56:40.000Z");
  assert.equal(trade.external_id, "123456789"); assert.equal(trade.exit_price, 1.16669);
});

test("Ukrainian headers and rows with problems are reported, not guessed", () => {
  const csv = "Пара;Напрямок;Дата відкриття;Ціна входу;Стоп;Прибуток;Комісія\n" +
    "XAUUSD;Продаж;25.08.2026 15:11;4640,34;4639,75;1,62;-0,15\n" +
    ";Купівля;25.08.2026 15:11;1;;;\n" +
    "EURUSD;hold;not a date;1;;;";
  const { mapping, results } = load(csv);
  assert.deepEqual(mapping, ["symbol", "direction", "opened_at", "entry_price", "stop_loss", "gross_pnl", "commission"]);
  assert.equal(results[0].trade.direction, "Short"); assert.equal(results[0].trade.entry_price, 4640.34);
  assert.deepEqual(results[1].errors, ["No symbol"]);
  assert.deepEqual(results[2].errors, ["No direction (buy/sell, long/short)", "Unreadable open date"]);
  assert.equal(results[2].trade, null);
  assert.deepEqual(results[1].warnings, ["No profit column: P&L will be 0"]);
});

test("duplicates: same ticket, or same symbol/direction/minute/entry; also inside the file", () => {
  const base = { direction: "Long", closed_at: null, exit_price: null, stop_loss: null, take_profit: null, volume: null, gross_pnl: 1, commission: null, swap: null, fee: null, risk_percent: null, risk_amount: null, setup: null, emotion: null, mistake: null, entry_reason: null, notes: null, screenshot_url: null, market: null, followed_plan: null };
  const candidates = [
    { ...base, symbol: "EURUSD", opened_at: "2026-08-25T14:50:12.000Z", entry_price: 1.16723, external_id: null },
    { ...base, symbol: "EUR/USD", opened_at: "2026-08-25T14:50:40.000Z", entry_price: 1.16723, external_id: null },
    { ...base, symbol: "GBPUSD", opened_at: "2026-08-25T15:00:00.000Z", entry_price: 1.3, external_id: "T-1" },
    { ...base, symbol: "XAUUSD", opened_at: "2026-08-25T16:00:00.000Z", entry_price: 2400, external_id: "T-9" },
  ];
  const existing = [{ symbol: "GBPUSD", direction: "Long", opened_at: "2026-01-01T00:00:00Z", entry_price: "1.1", external_id: "T-1" }];
  const { fresh, duplicates } = m.splitDuplicates(candidates, existing);
  assert.deepEqual(fresh.map(t => t.symbol), ["EURUSD", "XAUUSD"]);
  assert.deepEqual(duplicates.map(t => t.symbol), ["EUR/USD", "GBPUSD"]);
});

test("same trade read in another time zone is a likely duplicate with its offset", () => {
  const base = { closed_at: null, exit_price: null, stop_loss: null, take_profit: null, volume: null, gross_pnl: 1, commission: null, swap: null, fee: null, risk_percent: null, risk_amount: null, setup: null, emotion: null, mistake: null, entry_reason: null, notes: null, screenshot_url: null, market: null, followed_plan: null, external_id: null };
  const existing = [{ symbol: "EURUSD", direction: "Long", opened_at: "2026-08-25T11:50:00Z", entry_price: "1.16723000", external_id: null }];
  const file = [
    { ...base, symbol: "EURUSD", direction: "Long", opened_at: "2026-08-25T17:50:00.000Z", entry_price: 1.16723 },
    { ...base, symbol: "EURUSD", direction: "Long", opened_at: "2026-08-27T17:50:00.000Z", entry_price: 1.16723 },
    { ...base, symbol: "EURUSD", direction: "Short", opened_at: "2026-08-25T17:50:00.000Z", entry_price: 1.16723 },
  ];
  const { fresh, duplicates, shifted } = m.splitDuplicates(file, existing);
  assert.equal(duplicates.length, 0);
  assert.deepEqual(shifted.map(s => s.hours), [6]);
  assert.deepEqual(fresh.map(t => `${t.direction} ${t.opened_at.slice(8, 10)}`), ["Long 27", "Short 25"]);
});
