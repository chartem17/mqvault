#!/usr/bin/env node
// Backfill of initial stop, risk and R for existing journal trades (ADR 0020, docs/runbooks/trade-risk-backfill.md).
//
// DRY RUN by default: reads the database and prints what would change. Writes only with --apply, which needs the
// owner's approval of that exact run (preview and production share one database).
//
//   node scripts/backfill-trade-risk.mjs [--planned-percent=1] [--apply]
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in the environment (never printed) and the migration
// 20261116120000_trade_initial_risk applied. The formulas are the app's own: src/lib/journal/trade-financials.ts and
// src/lib/bridge/deals-to-trades.ts are compiled and reused, nothing is re-implemented here.

import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const args = new Map(process.argv.slice(2).map(arg => { const [key, value] = arg.replace(/^--/, "").split("="); return [key, value ?? true]; }));
const apply = args.get("apply") === true;
const plannedPercent = args.has("planned-percent") ? Number(args.get("planned-percent")) : null;
if (plannedPercent !== null && !(plannedPercent > 0 && plannedPercent <= 10)) throw new Error("--planned-percent must be between 0 and 10");

const outDir = ".tmp-backfill-trade-risk";
rmSync(outDir, { recursive: true, force: true });
execFileSync(process.execPath, [join("node_modules", "typescript", "bin", "tsc"), "src/lib/journal/trade-financials.ts", "src/lib/bridge/deals-to-trades.ts",
  "--outDir", outDir, "--module", "commonjs", "--target", "ES2020", "--skipLibCheck", "--rootDir", "src", "--lib", "ES2020,DOM", "--strict"], { stdio: "inherit" });
const require = createRequire(import.meta.url);
const { derivedFinancials, toNum, valueKey, valuesBySymbol } = require(`../${outDir}/lib/journal/trade-financials.js`);
const { buildTrades } = require(`../${outDir}/lib/bridge/deals-to-trades.js`);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required");
const db = createClient(url, key, { auth: { persistSession: false } });

async function all(table, columns, filter = q => q) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await filter(db.from(table).select(columns)).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

const accounts = new Map((await all("accounts", "id, initial_balance, broker_timezone")).map(row => [row.id, row]));
const trades = await all("journal_trades", "id, account_id, symbol, direction, opened_at, closed_at, entry_price, exit_price, stop_loss, initial_stop_loss, volume, gross_pnl, commission, swap, fee, net_pnl, risk_amount, risk_percent, risk_basis, result_r, source");

// 1. Bridge-linked trades: the initial stop is the stop of the order that opened the position (exact).
const initialFromBridge = new Map();
const terminals = await all("bridge_terminal_accounts", "id, account_id", q => q.not("account_id", "is", null));
for (const terminal of terminals) {
  const account = accounts.get(terminal.account_id);
  if (!account) continue;
  const n = value => (value === null || value === undefined ? 0 : Number(value));
  const deals = (await all("bridge_deals", "deal_ticket, order_ticket, position_id, time_msc, type, entry, symbol, volume, price, profit, commission, swap, fee, reason", q => q.eq("terminal_account_id", terminal.id)))
    .map(row => ({ ticket: n(row.deal_ticket), order: n(row.order_ticket), position_id: n(row.position_id), time_msc: n(row.time_msc), type: n(row.type), entry: n(row.entry), symbol: String(row.symbol), volume: n(row.volume), price: n(row.price), profit: n(row.profit), commission: n(row.commission), swap: n(row.swap), fee: n(row.fee), reason: n(row.reason) }));
  const orders = (await all("bridge_orders", "order_ticket, position_id, time_setup_msc, sl, tp", q => q.eq("terminal_account_id", terminal.id)))
    .map(row => ({ ticket: n(row.order_ticket), position_id: n(row.position_id), time_setup_msc: n(row.time_setup_msc), sl: n(row.sl), tp: n(row.tp) }));
  const stops = new Map(buildTrades(deals, orders, account.broker_timezone ?? "Etc/UTC").map(trade => [trade.key, trade.stop_loss]));
  for (const link of await all("bridge_positions", "position_key, trade_id", q => q.eq("terminal_account_id", terminal.id).not("trade_id", "is", null))) {
    if (stops.get(link.position_key) != null) initialFromBridge.set(link.trade_id, stops.get(link.position_key));
  }
}

// 2. Value of a price move per lot, per account and symbol, from the account's closed trades.
const byAccount = new Map();
for (const trade of trades) byAccount.set(trade.account_id, [...(byAccount.get(trade.account_id) ?? []), trade]);
const values = new Map([...byAccount].map(([id, list]) => [id, valuesBySymbol(list)]));

// 3. Recompute every row with the app's formulas.
const changes = [];
const tally = { initialFromBridge: 0, planned: 0, netFixed: 0, rBefore: 0, rAfter: 0, basis: {} };
for (const trade of trades) {
  const next = { ...trade };
  if (toNum(trade.initial_stop_loss) === null && initialFromBridge.has(trade.id)) { next.initial_stop_loss = initialFromBridge.get(trade.id); tally.initialFromBridge++; }
  const context = { initialBalance: toNum(accounts.get(trade.account_id)?.initial_balance), valuePerLot: values.get(trade.account_id)?.get(valueKey(trade.symbol)) ?? null };
  let derived = derivedFinancials(next, context);
  if (plannedPercent !== null && trade.closed_at && derived.risk_basis === null && context.initialBalance) {
    derived = derivedFinancials({ ...next, risk_basis: "planned", risk_amount: null, risk_percent: plannedPercent }, context);
    tally.planned++;
  }
  if (toNum(trade.result_r) !== null) tally.rBefore++;
  if (derived.result_r !== null) tally.rAfter++;
  tally.basis[derived.risk_basis ?? "none"] = (tally.basis[derived.risk_basis ?? "none"] ?? 0) + 1;
  const patch = {};
  if (next.initial_stop_loss !== trade.initial_stop_loss) patch.initial_stop_loss = next.initial_stop_loss;
  for (const [field, value] of Object.entries(derived)) {
    const before = trade[field];
    // Stored precision: money 2 decimals, R and % 4 decimals.
    const tolerance = field === "net_pnl" || field === "risk_amount" ? 0.005 : 0.00005;
    const same = value === null || typeof value === "number"
      ? (toNum(before) === null ? value === null : value !== null && Math.abs(toNum(before) - value) < tolerance)
      : (before ?? null) === value;
    if (!same) patch[field] = value;
  }
  if ("net_pnl" in patch) tally.netFixed++;
  if (Object.keys(patch).length) changes.push({ id: trade.id, symbol: trade.symbol, before: { net_pnl: trade.net_pnl, risk_amount: trade.risk_amount, result_r: trade.result_r }, patch });
}

console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", trades: trades.length, changed: changes.length, ...tally }, null, 2));
for (const change of changes.slice(0, 25)) console.log(change.symbol, JSON.stringify(change.before), "→", JSON.stringify(change.patch));
if (changes.length > 25) console.log(`… and ${changes.length - 25} more`);

if (apply) {
  for (const change of changes) {
    const { error } = await db.from("journal_trades").update(change.patch).eq("id", change.id);
    if (error) throw new Error(`update ${change.id}: ${error.message}`);
  }
  console.log(`Applied ${changes.length} updates.`);
}
rmSync(outDir, { recursive: true, force: true });
