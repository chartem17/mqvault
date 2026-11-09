import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const m = require("../.tmp-economic-calendar-tests/lib/news/economic-calendar.js");

const HEADER = "source,source_event_id,mt5_event_id,event_code,title,country,currency,impact,event_type,sector,frequency,all_day,tentative,scheduled_at,period,revision,actual,forecast,previous,revised_previous,unit,multiplier,digits,forecast_suspect";
const NFP = "mt5,200001,840030016,nonfarm-payrolls,Nonfarm Payrolls,US,USD,high,indicator,jobs,month,false,false,2024-01-05T13:30:00Z,2023-12-01,0,216.000000,170.000000,199.000000,173.000000,job,thousands,0,false";
const HOLIDAY = 'mt5,54165,756070001,new-years-day,"New Year\'s Day, observed",CH,CHF,holiday,holiday,holidays,none,true,false,2016-12-31T22:00:00Z,,0,,,,,none,none,0,false';

test("CSV records: header mapping, quotes, CRLF, BOM, trailing newline", () => {
  const recs = m.parseCsvRecords(`﻿${HEADER}\r\n${NFP}\r\n${HOLIDAY}\n`);
  assert.equal(recs.length, 2);
  assert.equal(recs[0].title, "Nonfarm Payrolls");
  assert.equal(recs[1].title, "New Year's Day, observed");
  assert.equal(recs[1].period, "");
  assert.deepEqual(m.parseCsvRecords(""), []);
  assert.deepEqual(m.parseCsvRecords('a,b\n"x ""q""",2'), [{ a: 'x "q"', b: "2" }]);
});

test("CSV row → import row keeps raw numbers and builds display values", () => {
  const [rec] = m.parseCsvRecords(`${HEADER}\n${NFP}`);
  const { row } = m.calendarRowFromCsv(rec);
  assert.equal(row.source, "mt5");
  assert.equal(row.external_id, "200001");
  assert.equal(row.source_series_id, "840030016");
  assert.equal(row.event_time, "2024-01-05T13:30:00.000Z");
  assert.equal(row.impact, "high");
  assert.equal(row.actual_value, 216);
  assert.equal(row.previous_value, 199);
  assert.equal(row.revised_previous_value, 173);
  assert.equal(row.actual, "216K");
  assert.equal(row.forecast, "170K");
  assert.equal(row.previous, "173K", "revised previous is what traders compare against");
  assert.equal(row.period, "2023-12-01");
  assert.equal(row.multiplier, "thousands");
  assert.equal(row.license_scope, "private");
  assert.equal(row.forecast_suspect, false);
});

test("holiday: all-day, no values, empty period", () => {
  const [, rec] = m.parseCsvRecords(`${HEADER}\n${NFP}\n${HOLIDAY}`);
  const { row } = m.calendarRowFromCsv(rec);
  assert.equal(row.impact, "holiday");
  assert.equal(row.event_type, "holiday");
  assert.equal(row.all_day, true);
  assert.equal(row.period, null);
  assert.equal(row.actual, null);
  assert.equal(row.actual_value, null);
});

test("invalid rows are reported, not guessed", () => {
  const [rec] = m.parseCsvRecords(`${HEADER}\n${NFP}`);
  assert.match(m.calendarRowFromCsv({ ...rec, source_event_id: "" }).error, /source_event_id/);
  assert.match(m.calendarRowFromCsv({ ...rec, scheduled_at: "2024-01-05 13:30:00" }).error, /UTC/);
  assert.match(m.calendarRowFromCsv({ ...rec, impact: "HIGHEST" }).error, /impact/);
  assert.match(m.calendarRowFromCsv({ ...rec, title: " ", event_code: "" }).error, /title/);
  assert.equal(m.calendarRowFromCsv({ ...rec, title: "", event_code: "kings-birthday" }).row.title, "Kings Birthday");
});

test("display values: multipliers, percent, digits, negative zero", () => {
  const f = m.formatCalendarValue;
  assert.equal(f(0.6, { unit: "percent", multiplier: "none", digits: 1 }), "0.6%");
  assert.equal(f(-12.345, { unit: "currency", multiplier: "billions", digits: 2 }), "-12.35B");
  assert.equal(f(-0.01, { unit: "percent", multiplier: "none", digits: 1 }), "0.0%");
  assert.equal(f(1.5, { unit: null, multiplier: null, digits: null }), "1.50");
  assert.equal(f(null, { unit: "percent", multiplier: "none", digits: 1 }), null);
});

test("surprise ignores suspect forecasts", () => {
  assert.equal(m.calendarSurprise(216, 170, false), 46);
  assert.equal(m.calendarSurprise(0.3, 0.1, false), 0.2);
  assert.equal(m.calendarSurprise(216, 170, true), null);
  assert.equal(m.calendarSurprise(null, 170, false), null);
});

test("query: defaults, validation and range limit", () => {
  const now = new Date("2026-11-08T12:00:00Z");
  const q = m.parseCalendarQuery(new URLSearchParams(""), now).query;
  assert.equal(q.from.toISOString(), "2026-11-07T12:00:00.000Z");
  assert.equal(q.to.toISOString(), "2026-11-15T12:00:00.000Z");
  assert.equal(q.currencies, null);
  assert.deepEqual(q.impacts, ["high", "medium", "holiday"]);

  const custom = m.parseCalendarQuery(new URLSearchParams("from=2026-11-01T22:00:00Z&to=2026-11-08T22:00:00Z&currencies=usd,eur,USD&impact=high"), now).query;
  assert.deepEqual(custom.currencies, ["USD", "EUR"]);
  assert.deepEqual(custom.impacts, ["high"]);

  assert.ok(m.parseCalendarQuery(new URLSearchParams("from=nope"), now).error);
  assert.ok(m.parseCalendarQuery(new URLSearchParams("from=2026-11-08T00:00:00Z&to=2026-11-01T00:00:00Z"), now).error);
  assert.ok(m.parseCalendarQuery(new URLSearchParams("from=2026-01-01T00:00:00Z&to=2026-12-01T00:00:00Z"), now).error);
  assert.ok(m.parseCalendarQuery(new URLSearchParams("currencies=US$"), now).error);
  assert.ok(m.parseCalendarQuery(new URLSearchParams("impact=extreme"), now).error);
});

test("currencies from trades: only calendar currencies, stable order", () => {
  assert.deepEqual(m.currenciesFromTrades([
    { base_asset: "eur", quote_asset: "usd" },
    { symbol: "GBPJPY.m" },
    { symbol: "XAUUSD" },
    { symbol: "US30", base_asset: null },
    { symbol: "BTCUSDT" },
  ]), ["USD", "EUR", "GBP", "JPY"]);
  assert.deepEqual(m.currenciesFromTrades([]), []);
});

test("DB row → API event", () => {
  const event = m.toCalendarEvent({
    id: "x", title: "CPI y/y", country: "GB", currency: "GBP", impact: "high", event_time: "2024-01-17T07:00:00+00:00",
    actual: "4.0%", forecast: "3.8%", previous: "3.9%", event_type: "indicator", all_day: false, tentative: null,
    actual_value: "4.0", forecast_value: 3.8, forecast_suspect: false, source: "mt5",
  });
  assert.equal(event.time, "2024-01-17T07:00:00.000Z");
  assert.equal(event.surprise, 0.2);
  assert.equal(event.tentative, false);
  assert.equal(m.toCalendarEvent({ ...event, id: "y", event_time: event.time, impact: "Unknown", event_type: null, all_day: null, actual_value: null, forecast_value: null, forecast_suspect: null }).impact, "none");
});

const RAW = {
  value_id: "200001", event_id: "840030016", event_code: "nonfarm-payrolls", event_name: "Nonfarm Payrolls", country_code: "US", currency: "USD",
  importance: "CALENDAR_IMPORTANCE_HIGH", event_type: "CALENDAR_TYPE_INDICATOR", sector: "CALENDAR_SECTOR_JOBS", frequency: "CALENDAR_FREQUENCY_MONTH",
  time_mode: "CALENDAR_TIMEMODE_DATETIME", unit: "CALENDAR_UNIT_JOB", multiplier: "CALENDAR_MULTIPLIER_THOUSANDS", digits: 0,
  server_time: "2024.01.05 15:30:00", period: "2023-12-01", revision: 0, actual: "216.000000", forecast: "170.000000", previous: "199.000000", revised_previous: "173.000000",
};

test("raw MT5 value → clean record (same rules as clean_calendar.py)", () => {
  const { record } = m.cleanRecordFromMt5(RAW, 120);
  assert.equal(record.scheduled_at, "2024-01-05T13:30:00Z", "server time minus the current server offset");
  assert.equal(record.impact, "high");
  assert.equal(record.event_type, "indicator");
  assert.equal(record.sector, "jobs");
  assert.equal(record.frequency, "month");
  assert.equal(record.unit, "job");
  assert.equal(record.multiplier, "thousands");
  assert.equal(record.all_day, "false");
  assert.equal(record.forecast_suspect, "false");
  const { row } = m.calendarRowFromCsv(record);
  assert.equal(row.actual, "216K");
  assert.equal(row.previous, "173K");

  assert.equal(m.cleanRecordFromMt5({ ...RAW, importance: "CALENDAR_IMPORTANCE_MODERATE" }, 0).record.impact, "medium");
  const holiday = m.cleanRecordFromMt5({ ...RAW, event_type: "CALENDAR_TYPE_HOLIDAY", importance: "CALENDAR_IMPORTANCE_NONE", time_mode: "CALENDAR_TIMEMODE_DATE", period: "1970-01-01" }, 0).record;
  assert.equal(holiday.impact, "holiday");
  assert.equal(holiday.all_day, "true");
  assert.equal(holiday.period, "");
  assert.equal(m.cleanRecordFromMt5({ ...RAW, time_mode: "CALENDAR_TIMEMODE_TENTATIVE" }, 0).record.tentative, "true");
  assert.equal(m.cleanRecordFromMt5({ ...RAW, server_time: "2024-01-05 00:30" }, -300).record.scheduled_at, "2024-01-05T05:30:00Z");

  assert.ok(m.cleanRecordFromMt5({ ...RAW, value_id: "" }, 0).error);
  assert.ok(m.cleanRecordFromMt5({ ...RAW, value_id: "1; drop" }, 0).error);
  assert.ok(m.cleanRecordFromMt5({ ...RAW, server_time: "yesterday" }, 0).error);
  assert.ok(m.cleanRecordFromMt5(RAW, 1000).error, "offset beyond ±14 h");
  assert.ok(m.cleanRecordFromMt5({ ...RAW, importance: "SOMETHING" }, 0).error);
});

test("suspect forecast: far from previous and actual relative to the series' typical change", () => {
  const series = [150, 180, 160, 200, 170, 190, 210, 175];   // median |Δ| = 30
  assert.equal(m.forecastLooksSuspect(78356, 199, 216, series), true, "NFP 2020-style glitch");
  assert.equal(m.forecastLooksSuspect(170, 199, 216, series), false);
  assert.equal(m.forecastLooksSuspect(1, 199, 216, series), false, "198 away < 8 × 30: not caught (known gap)");
  assert.equal(m.forecastLooksSuspect(78356, 199, 216, series.slice(0, 6)), false, "needs ≥ 6 changes");
  assert.equal(m.forecastLooksSuspect(null, 199, 216, series), false);
  assert.equal(m.forecastLooksSuspect(5000, null, null, series), false);
  assert.equal(m.forecastLooksSuspect(5000, 1, 1, [1, 1, 1, 1, 1, 1, 1, 1]), false, "flat series has no scale");
});
