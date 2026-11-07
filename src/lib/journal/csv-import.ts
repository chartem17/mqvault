import { zonedWallTime } from "../time/timezone";
import { msg } from "../i18n/core";
import { UK_EMOTIONS, UK_HEADER_ALIASES, UK_LONG, UK_NO, UK_SHORT, UK_YES } from "../i18n/import-synonyms";

/**
 * CSV trade import. Files come from brokers, exchanges and hand-made journals: the same data in any
 * column order, under different names, with different number and date formats. This module:
 *  1. parses CSV (delimiter , ; tab or |, quotes, BOM, CRLF);
 *  2. guesses which column is which canonical trade field from its header (EN/UA synonyms);
 *  3. turns each row into a canonical trade, reporting what is missing or unreadable.
 * Nothing is inferred beyond the file: empty stays empty. Net P&L and R are computed by the server.
 */

export type ImportField =
  | "symbol" | "direction" | "opened_at" | "closed_at" | "open_date" | "open_time" | "close_date" | "close_time"
  | "entry_price" | "exit_price" | "stop_loss" | "take_profit" | "volume"
  | "gross_pnl" | "net_pnl" | "commission" | "swap" | "fee" | "risk_percent" | "risk_amount"
  | "setup" | "emotion" | "mistake" | "followed_plan" | "entry_reason" | "notes" | "screenshot_url" | "external_id" | "market";

/** English labels (translated in the UI). */
export const IMPORT_FIELDS: readonly { field: ImportField; label: string }[] = [
  { field: "symbol", label: msg("Symbol") }, { field: "direction", label: msg("Direction") },
  { field: "opened_at", label: msg("Open date & time") }, { field: "open_date", label: msg("Open date") }, { field: "open_time", label: msg("Open time") },
  { field: "closed_at", label: msg("Close date & time") }, { field: "close_date", label: msg("Close date") }, { field: "close_time", label: msg("Close time") },
  { field: "entry_price", label: msg("Entry price") }, { field: "exit_price", label: msg("Exit price") },
  { field: "stop_loss", label: msg("Stop loss") }, { field: "take_profit", label: msg("Take profit") }, { field: "volume", label: msg("Volume") },
  { field: "gross_pnl", label: msg("Profit (before costs)") }, { field: "net_pnl", label: msg("Net P&L") },
  { field: "commission", label: msg("Commission") }, { field: "swap", label: msg("Swap") }, { field: "fee", label: msg("Fee") },
  { field: "risk_percent", label: msg("Risk %") }, { field: "risk_amount", label: msg("Risk amount") },
  { field: "setup", label: msg("Setup") }, { field: "emotion", label: msg("Emotion") }, { field: "mistake", label: msg("Mistake") },
  { field: "followed_plan", label: msg("Followed the plan") }, { field: "entry_reason", label: msg("Entry reason") }, { field: "notes", label: msg("Notes") },
  { field: "screenshot_url", label: msg("Screenshot link") }, { field: "external_id", label: msg("Ticket / ID") }, { field: "market", label: msg("Market") },
];

// ---------------------------------------------------------------- CSV

/** Most frequent candidate delimiter outside quotes in the first lines. */
export function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 10).join("\n");
  let best = ",", bestCount = 0;
  for (const candidate of [",", ";", "\t", "|"]) {
    let count = 0, quoted = false;
    for (const char of sample) { if (char === '"') quoted = !quoted; else if (!quoted && char === candidate) count++; }
    if (count > bestCount) { best = candidate; bestCount = count; }
  }
  return best;
}

/** RFC-4180-ish parser: quoted fields, doubled quotes, newlines inside quotes. Blank lines are dropped. */
export function parseCsv(input: string, delimiter = detectDelimiter(input.replace(/^﻿/, ""))): string[][] {
  const text = input.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"') { if (text[index + 1] === '"') { field += '"'; index++; } else quoted = false; }
      else field += char;
    } else if (char === '"' && field.trim() === "") { quoted = true; field = ""; }
    else if (char === delimiter) { row.push(field); field = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index++;
      row.push(field); field = "";
      if (row.some(cell => cell.trim() !== "")) rows.push(row);
      row = [];
    } else field += char;
  }
  row.push(field);
  if (row.some(cell => cell.trim() !== "")) rows.push(row);
  return rows.map(cells => cells.map(cell => cell.trim()));
}

// ---------------------------------------------------------------- header detection

const norm = (header: string) => header.toLowerCase().replace(/\((usd|usdt|\$|%)\)|_(usd|usdt)$|\busd\b|\busdt\b/g, "").replace(/[^\p{L}\p{N}%#]/gu, "");

/** Normalised header → field. Two-in-a-row "time"/"price" (MT5 positions) are resolved by order in detectColumns. */
const ALIASES: Record<ImportField, string[]> = {
  symbol: ["symbol", "pair", "instrument", "ticker", "asset", "marketsymbol", "contract"],
  direction: ["side", "direction", "type", "position", "buysell", "longshort", "dir", "action"],
  opened_at: ["openat", "opentime", "openedat", "opendatetime", "entrytime", "entrydate", "timeopen", "opendate time", "timeopened"],
  open_date: ["date", "tradedate"],
  open_time: ["time"],
  closed_at: ["closeat", "closetime", "closedat", "closedatetime", "exittime", "exitdate", "timeclose"],
  close_date: ["closedate"],
  close_time: [],
  entry_price: ["entryprice", "entry", "openprice", "priceopen", "price"],
  exit_price: ["exitprice", "exit", "closeprice", "priceclose"],
  stop_loss: ["sl", "stoploss", "stop", "s l"],
  take_profit: ["tp", "takeprofit", "take", "target", "t p"],
  volume: ["lots", "lot", "volume", "size", "qty", "quantity", "amount"],
  gross_pnl: ["profit", "grosspnl", "gross", "grossprofit", "pnlgross", "realizedpnl"],
  net_pnl: ["net", "netpnl", "netprofit", "pnl", "pl", "p l", "pnlnet"],
  commission: ["commission", "commissions", "comm"],
  swap: ["swap", "swaps", "rollover"],
  fee: ["fee", "fees", "tradingfee"],
  risk_percent: ["risk%", "riskpercent", "riskpct", "risk"],
  risk_amount: ["riskamount", "riskusd", "risk$"],
  setup: ["setup", "strategy", "model"],
  emotion: ["emotion", "emotions", "mood", "feeling"],
  mistake: ["mistake", "mistakes", "error"],
  followed_plan: ["followrules", "followedrules", "followedplan", "plan", "byplan", "rulesfollowed"],
  entry_reason: ["entryreason", "entrycriteria", "reason", "reasonforentry", "why"],
  notes: ["notes", "note", "comment", "comments", "description"],
  screenshot_url: ["screenshot", "screenshoturl", "chart", "image", "link", "url"],
  external_id: ["ticket", "order", "deal", "id", "tradeid", "position id", "positionid", "orderid", "trade", "#"],
  market: ["market", "assetclass", "category"],
};
const LOOKUP = new Map<string, ImportField>();
for (const [field, names] of Object.entries(ALIASES) as [ImportField, string[]][]) for (const name of [...names, ...(UK_HEADER_ALIASES[field] ?? [])]) if (!LOOKUP.has(norm(name))) LOOKUP.set(norm(name), field);

export type ColumnMapping = (ImportField | null)[];

/**
 * Field per column from the headers. Each field is used once; a repeated "time"/"price" header
 * becomes the closing time/price (MT5 positions report). Unknown columns stay unmapped.
 */
export function detectColumns(headers: readonly string[], sample: readonly string[][] = []): ColumnMapping {
  return refineByValues(detectByHeaders(headers), headers, sample);
}

function detectByHeaders(headers: readonly string[]): ColumnMapping {
  const used = new Set<ImportField>();
  return headers.map(header => {
    const key = norm(header);
    let field = LOOKUP.get(key) ?? null;
    if (field === null && /^(open|entry).*(time|date)/.test(key)) field = "opened_at";
    if (field === null && /^(close|exit).*(time|date)/.test(key)) field = "closed_at";
    if (field && used.has(field)) {
      const second: Partial<Record<ImportField, ImportField>> = { open_time: "closed_at", opened_at: "closed_at", entry_price: "exit_price", open_date: "close_date" };
      field = second[field] && !used.has(second[field]!) ? second[field]! : null;
    }
    if (field) used.add(field);
    return field;
  }).map((field, _index, all) => {
    // A lone "time" column with no date column is the full open timestamp (MT5 writes "2026.08.25 17:50:00").
    if (field === "open_time" && !all.includes("open_date")) return "opened_at";
    if (field === "open_date" && !all.includes("open_time")) return "opened_at";
    return field;
  });
}

/** Share of non-empty sample values in a column that pass `test`. */
function share(sample: readonly string[][], column: number, test: (value: string) => boolean) {
  const values = sample.map(row => row[column]?.trim() ?? "").filter(Boolean);
  return values.length ? values.filter(test).length / values.length : 0;
}

/**
 * Headers lie: "Type" may hold "Continuation" while "Position" holds Long/Short (hand-made journals), and in
 * MT5 reports "Position" is the ticket while "Type" is buy/sell. The direction goes to the column whose
 * values actually read as directions; a numeric column named like a direction becomes the ticket.
 */
function refineByValues(mapping: ColumnMapping, headers: readonly string[], sample: readonly string[][]): ColumnMapping {
  if (!sample.length) return mapping;
  const next = [...mapping];
  const isDirection = (index: number) => share(sample, index, value => parseDirection(value) !== null) >= 0.8;
  const current = next.indexOf("direction");
  if (current === -1 || !isDirection(current)) {
    const candidate = headers.findIndex((header, index) => index !== current && (next[index] === null || LOOKUP.get(norm(header)) === "direction") && isDirection(index));
    if (candidate !== -1) {
      if (current !== -1) next[current] = null;
      next[candidate] = "direction";
    }
  }
  headers.forEach((header, index) => {
    if (next[index] === null && LOOKUP.get(norm(header)) === "direction" && !next.includes("external_id") && share(sample, index, value => /^\d{3,}$/.test(value)) >= 0.8) next[index] = "external_id";
  });
  return next;
}

// ---------------------------------------------------------------- values

/** "1 234,56", "1,234.56", "$-12.5", "(12.50)", "3%", "−4.5" → number; empty or unreadable → null. */
export function parseNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  let text = raw.trim().replace(/[−‒–]/g, "-").replace(/[%$€£\s ']/g, "").replace(/usdt?$/i, "");
  if (!text || text === "-") return null;
  let negative = false;
  if (/^\(.*\)$/.test(text)) { negative = true; text = text.slice(1, -1); }
  const comma = text.lastIndexOf(","), dot = text.lastIndexOf(".");
  if (comma > -1 && dot > -1) text = comma > dot ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
  else if (comma > -1) text = /^-?\d{1,3}(,\d{3})+$/.test(text) ? text.replace(/,/g, "") : text.replace(",", ".");
  const value = Number(text);
  return Number.isFinite(value) ? (negative ? -value : value) : null;
}

export function parseDirection(raw: string | undefined): "Long" | "Short" | null {
  const text = (raw ?? "").trim().toLowerCase();
  const word = text.split(/[\s_-]/)[0];
  if (["buy", "long", "b", "l", "bull", ...UK_LONG].includes(word) || text.startsWith("buy")) return "Long";
  if (["sell", "short", "s", "bear", ...UK_SHORT].includes(word) || text.startsWith("sell")) return "Short";
  return null;
}

export function parseYesNo(raw: string | undefined): boolean | null {
  const text = (raw ?? "").trim().toLowerCase();
  if (["yes", "y", "true", "1", "+", "✓", "✔", ...UK_YES].includes(text)) return true;
  if (["no", "n", "false", "0", "-", "✗", "✘", ...UK_NO].includes(text)) return false;
  return null;
}

export type DateOrder = "dmy" | "mdy";
type DateParts = { y: number; m: number; d: number; hh: number; mm: number; ss: number; hasTime: boolean };

/** Date with optional time: ISO, 2026.08.25 17:50:00 (MT5), 25.08.2026, 10/03/2025 (order decides), Unix seconds/ms. */
export function parseDateParts(raw: string | undefined, order: DateOrder): DateParts | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  if (/^\d{10}(\d{3})?$/.test(text)) {
    const date = new Date(text.length === 10 ? Number(text) * 1000 : Number(text));
    return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate(), hh: date.getUTCHours(), mm: date.getUTCMinutes(), ss: date.getUTCSeconds(), hasTime: true };
  }
  const time = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i.exec(text);
  let hh = time ? Number(time[1]) : 0;
  if (time?.[4]) hh = (hh % 12) + (time[4].toLowerCase() === "pm" ? 12 : 0);
  const mm = time ? Number(time[2]) : 0, ss = time?.[3] ? Number(time[3]) : 0;
  let y: number, m: number, d: number;
  const ymd = /(\d{4})[-./](\d{1,2})[-./](\d{1,2})/.exec(text);
  const other = /(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})/.exec(text);
  if (ymd) { y = Number(ymd[1]); m = Number(ymd[2]); d = Number(ymd[3]); }
  else if (other) {
    const a = Number(other[1]), b = Number(other[2]);
    y = Number(other[3]); if (y < 100) y += 2000;
    [d, m] = order === "dmy" ? [a, b] : [b, a];
  } else return null;
  if (m < 1 || m > 12 || d < 1 || d > 31 || hh > 23 || mm > 59 || ss > 59) return null;
  return { y, m, d, hh, mm, ss, hasTime: Boolean(time) };
}

/** dd/mm vs mm/dd from the data: a first part above 12 means day-first, a second part above 12 means month-first. */
export function detectDateOrder(values: readonly string[]): DateOrder | "ambiguous" {
  let dmy = false, mdy = false;
  for (const value of values) {
    if (/\d{4}[-./]\d{1,2}[-./]\d{1,2}/.test(value)) continue;
    const match = /(\d{1,2})[-./](\d{1,2})[-./]\d{2,4}/.exec(value);
    if (!match) continue;
    if (Number(match[1]) > 12) dmy = true;
    if (Number(match[2]) > 12) mdy = true;
  }
  if (dmy && !mdy) return "dmy";
  if (mdy && !dmy) return "mdy";
  return "ambiguous";
}

/** Wall time of the file (broker zone) → UTC ISO. */
function toIso(parts: DateParts, timezone: string): string | null {
  const day = `${String(parts.y).padStart(4, "0")}-${String(parts.m).padStart(2, "0")}-${String(parts.d).padStart(2, "0")}`;
  try { return new Date(zonedWallTime(day, `${String(parts.hh).padStart(2, "0")}:${String(parts.mm).padStart(2, "0")}`, timezone) + parts.ss * 1000).toISOString(); }
  catch { return null; }
}

// ---------------------------------------------------------------- rows → trades

export type ImportedTrade = {
  symbol: string; direction: "Long" | "Short"; opened_at: string; closed_at: string | null;
  entry_price: number | null; exit_price: number | null; stop_loss: number | null; take_profit: number | null; volume: number | null;
  gross_pnl: number | null; commission: number | null; swap: number | null; fee: number | null;
  risk_percent: number | null; risk_amount: number | null;
  setup: string | null; emotion: string | null; mistake: string | null; entry_reason: string | null; notes: string | null; screenshot_url: string | null; external_id: string | null; market: string | null;
  followed_plan: boolean | null;
};
export type RowResult = { line: number; trade: ImportedTrade | null; errors: string[]; warnings: string[] };
export type ImportOptions = { timezone: string; dateOrder: DateOrder };

const EMOTIONS: Record<string, string> = { calm: "Calm", neutral: "Neutral", tired: "Tired", angry: "Angry", ...UK_EMOTIONS };

/** One data row → canonical trade. `line` is the 1-based line in the file (header = 1). */
export function rowToTrade(cells: readonly string[], mapping: ColumnMapping, options: ImportOptions, line: number): RowResult {
  const errors: string[] = [], warnings: string[] = [];
  const get = (field: ImportField) => { const index = mapping.indexOf(field); return index === -1 ? undefined : cells[index]; };
  const text = (field: ImportField) => get(field)?.trim() || null;
  const num = (field: ImportField) => {
    const raw = get(field);
    const value = parseNumber(raw);
    if (raw && raw.trim() && value === null) warnings.push(msg("Unreadable number"));
    return value;
  };
  const date = (combined: ImportField, dateField: ImportField, timeField: ImportField) => {
    const raw = text(combined) ?? [text(dateField), text(timeField)].filter(Boolean).join(" ");
    if (!raw) return { iso: null, raw: "" };
    const parts = parseDateParts(raw, options.dateOrder);
    return { iso: parts ? toIso(parts, options.timezone) : null, raw };
  };

  const symbol = (text("symbol") ?? "").toUpperCase().replace(/\s+/g, "");
  if (!symbol) errors.push(msg("No symbol"));
  const direction = parseDirection(get("direction"));
  if (!direction) errors.push(msg("No direction (buy/sell, long/short)"));
  const opened = date("opened_at", "open_date", "open_time");
  if (!opened.iso) errors.push(opened.raw ? msg("Unreadable open date") : msg("No open date"));
  const closed = date("closed_at", "close_date", "close_time");
  if (closed.raw && !closed.iso) warnings.push(msg("Unreadable close date"));

  const commission = num("commission"), fee = num("fee"), swap = num("swap");
  let gross = num("gross_pnl");
  const net = num("net_pnl");
  // Only a net result in the file: gross = net + costs − swap, so the server's net formula gives the same number back.
  if (gross === null && net !== null) gross = net + Math.abs(commission ?? 0) + Math.abs(fee ?? 0) - (swap ?? 0);
  if (gross === null) warnings.push(msg("No profit column: P&L will be 0"));

  const emotionRaw = text("emotion");
  const trade: ImportedTrade = {
    symbol, direction: direction ?? "Long", opened_at: opened.iso ?? "", closed_at: closed.iso,
    entry_price: num("entry_price"), exit_price: num("exit_price"), stop_loss: num("stop_loss"), take_profit: num("take_profit"), volume: num("volume"),
    gross_pnl: gross === null ? null : Math.round(gross * 1e8) / 1e8, commission, swap, fee,
    risk_percent: num("risk_percent"), risk_amount: num("risk_amount"),
    setup: text("setup"), emotion: emotionRaw ? EMOTIONS[emotionRaw.toLowerCase()] ?? emotionRaw : null, mistake: text("mistake"), entry_reason: text("entry_reason"),
    notes: text("notes"), screenshot_url: text("screenshot_url"), external_id: text("external_id"), market: text("market"),
    followed_plan: parseYesNo(get("followed_plan")),
  };
  return { line, trade: errors.length ? null : trade, errors, warnings: [...new Set(warnings)] };
}

export function rowsToTrades(rows: readonly string[][], mapping: ColumnMapping, options: ImportOptions): RowResult[] {
  return rows.map((cells, index) => rowToTrade(cells, mapping, options, index + 2));
}

/** Date order for a mapping: detected from the date columns, day-first when the data cannot tell. */
export function dateOrderFor(rows: readonly string[][], mapping: ColumnMapping): { order: DateOrder; ambiguous: boolean } {
  const columns = (["opened_at", "open_date", "closed_at", "close_date"] as ImportField[]).map(field => mapping.indexOf(field)).filter(index => index > -1);
  const detected = detectDateOrder(rows.flatMap(row => columns.map(index => row[index] ?? "")));
  return detected === "ambiguous" ? { order: "dmy", ambiguous: rows.length > 0 && columns.length > 0 } : { order: detected, ambiguous: false };
}

// ---------------------------------------------------------------- duplicates

export type ExistingTrade = { symbol: string; direction: string; opened_at: string; entry_price?: number | string | null; external_id?: string | null };
const symbolKey = (symbol: string) => symbol.replace(/[^a-z0-9]/gi, "").toUpperCase();
const minute = (iso: string) => Math.floor(Date.parse(iso) / 60_000);
const price = (value: number | string | null | undefined) => { const n = typeof value === "string" ? Number(value) : value; return typeof n === "number" && Number.isFinite(n) ? Math.round(n * 1e6) / 1e6 : null; };
function fingerprint(trade: ExistingTrade) { return `${symbolKey(trade.symbol)}|${trade.direction}|${minute(trade.opened_at)}|${price(trade.entry_price) ?? ""}`; }

/**
 * Splits candidates into new trades and duplicates of the account's existing trades (or of earlier
 * rows in the same file). A duplicate has the same ticket, or the same symbol, direction, opening
 * minute and entry price. A trade with the same symbol, direction and exact entry price opened within
 * 24 hours of an existing one is a likely duplicate read in another time zone: it is skipped too and
 * the offset in hours is reported so the user can correct the zone.
 */
export function splitDuplicates<T extends ImportedTrade>(candidates: readonly T[], existing: readonly ExistingTrade[]): { fresh: T[]; duplicates: T[]; shifted: { trade: T; hours: number }[] } {
  const tickets = new Set(existing.map(trade => trade.external_id?.trim()).filter((id): id is string => Boolean(id)));
  const prints = new Set(existing.map(fingerprint));
  const byPrice = new Map<string, number[]>();
  const priceKey = (trade: ExistingTrade) => { const p = price(trade.entry_price); return p === null ? null : `${symbolKey(trade.symbol)}|${trade.direction}|${p}`; };
  const remember = (trade: ExistingTrade) => { const key = priceKey(trade); if (key) byPrice.set(key, [...(byPrice.get(key) ?? []), Date.parse(trade.opened_at)]); };
  existing.forEach(remember);
  const fresh: T[] = [], duplicates: T[] = [], shifted: { trade: T; hours: number }[] = [];
  for (const trade of candidates) {
    const ticket = trade.external_id?.trim();
    const print = fingerprint(trade);
    if ((ticket && tickets.has(ticket)) || prints.has(print)) { duplicates.push(trade); continue; }
    const key = priceKey(trade);
    const at = Date.parse(trade.opened_at);
    const near = key ? (byPrice.get(key) ?? []).find(time => Math.abs(time - at) <= 24 * 3_600_000) : undefined;
    if (near !== undefined) { shifted.push({ trade, hours: Math.round(((at - near) / 3_600_000) * 2) / 2 }); continue; }
    fresh.push(trade);
    if (ticket) tickets.add(ticket);
    prints.add(print);
    remember(trade);
  }
  return { fresh, duplicates, shifted };
}
