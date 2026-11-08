#!/usr/bin/env node
// Imports the clean MT5 calendar CSV (output of clean_calendar.py) into news_events.
//
//   node --experimental-strip-types tools/econ-calendar/import-calendar.mjs <clean.csv>           # dry run: validate + summary, no network
//   node --experimental-strip-types tools/econ-calendar/import-calendar.mjs <clean.csv> --apply   # upsert in batches
//
// --apply needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in the environment and the
// migration 20261108180000_news_events_calendar_fields applied. It calls the import_news_events RPC,
// which writes only rows that changed, so re-running the same file is safe.
// Production import only after the owner's explicit approval (CLAUDE.md). Never commit the CSV.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { calendarRowFromCsv, parseCsvRecords } from "../../src/lib/news/economic-calendar.ts";

const BATCH = 1000;
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const apply = args.includes("--apply");
if (!file) {
  console.error("usage: import-calendar.mjs <clean.csv> [--apply]");
  process.exit(2);
}

const records = parseCsvRecords(readFileSync(file, "utf8"));
const rows = [];
const errors = new Map();
const seen = new Set();
let duplicates = 0;
for (const record of records) {
  const result = calendarRowFromCsv(record);
  if ("error" in result) {
    errors.set(result.error, (errors.get(result.error) ?? 0) + 1);
    continue;
  }
  const key = `${result.row.source}|${result.row.external_id}`;
  if (seen.has(key)) { duplicates++; continue; }
  seen.add(key);
  rows.push(result.row);
}

const count = (pick) => Object.fromEntries([...rows.reduce((m, r) => m.set(pick(r), (m.get(pick(r)) ?? 0) + 1), new Map())].sort());
const times = rows.map((r) => r.event_time).sort();
console.log(JSON.stringify({
  file,
  records: records.length,
  valid: rows.length,
  duplicates,
  invalid: Object.fromEntries(errors),
  range: [times[0] ?? null, times.at(-1) ?? null],
  byCurrency: count((r) => r.currency),
  byImpact: count((r) => r.impact),
  withActual: rows.filter((r) => r.actual_value !== null).length,
  withForecast: rows.filter((r) => r.forecast_value !== null).length,
  forecastSuspect: rows.filter((r) => r.forecast_suspect).length,
}, null, 2));

if (!apply) {
  console.log("Dry run: nothing written. Add --apply to import.");
  process.exit(errors.size ? 1 : 0);
}
if (errors.size) {
  console.error("Refusing to import: fix invalid rows first.");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required for --apply.");
  process.exit(2);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const totals = { inserted: 0, updated: 0, unchanged: 0 };
for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  const { data, error } = await db.rpc("import_news_events", { p_rows: batch });
  if (error) {
    console.error(`Batch ${i / BATCH + 1} failed after ${i} rows:`, error.message);
    console.error("Totals so far:", totals);
    process.exit(1);
  }
  const r = Array.isArray(data) ? data[0] : data;
  totals.inserted += r.inserted;
  totals.updated += r.updated;
  totals.unchanged += r.unchanged;
  process.stdout.write(`\r${Math.min(i + BATCH, rows.length)}/${rows.length}`);
}
console.log("\nDone:", totals);
