/**
 * Strict schemas of what a Bridge device may send (features/mt5-bridge.md §3.5). Anything unexpected — an extra
 * field, a wrong type, too many rows — rejects the whole request: a signed device is still untrusted input.
 */
import type { Mt5Deal, Mt5Order } from "./deals-to-trades";

export const MAX_TERMINALS = 8;
export const MAX_DEALS_PER_BATCH = 1000;
export const MAX_ORDERS_PER_BATCH = 2000;
export const MAX_WEEK_STARTS = 60;

export type TerminalAccount = { server: string; login: string; company: string | null; trade_mode: "demo" | "real" | "contest"; currency: string | null };
export type HeartbeatTerminal = TerminalAccount & { balance: number | null; equity: number | null; server_offset_minutes: number | null; week_starts: number[] };
export type Heartbeat = { bridge_version: string; terminals: HeartbeatTerminal[] };
export type DealsBatch = { account: { server: string; login: string }; deals: Mt5Deal[]; orders: Mt5Order[] };

type Row = Record<string, unknown>;
const isRow = (value: unknown): value is Row => !!value && typeof value === "object" && !Array.isArray(value);
const onlyKeys = (row: Row, keys: readonly string[]) => Object.keys(row).every(key => keys.includes(key));
const int = (value: unknown, min = 0) => (typeof value === "number" && Number.isSafeInteger(value) && value >= min ? value : null);
const finite = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const printable = (value: unknown, max: number) =>
  typeof value === "string" && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value) ? value.trim() || null : null;

export const parseLogin = (value: unknown) => (typeof value === "string" && /^\d{1,20}$/.test(value) ? value : null);
export const parseServer = (value: unknown) => printable(value, 64);
/** 2001-01-01 … 2100-01-01 in milliseconds: rejects seconds sent by mistake and absurd values. */
const timeMs = (value: unknown) => { const n = int(value, 978_307_200_000); return n !== null && n < 4_102_444_800_000 ? n : null; };

function parseTerminal(raw: unknown): HeartbeatTerminal | null {
  if (!isRow(raw) || !onlyKeys(raw, ["server", "login", "company", "trade_mode", "currency", "balance", "equity", "server_offset_minutes", "week_starts"])) return null;
  const server = parseServer(raw.server), login = parseLogin(raw.login);
  const tradeMode = raw.trade_mode === "demo" || raw.trade_mode === "real" || raw.trade_mode === "contest" ? raw.trade_mode : null;
  if (!server || !login || !tradeMode) return null;
  const company = raw.company === undefined || raw.company === null ? null : printable(raw.company, 120);
  const currency = raw.currency === undefined || raw.currency === null ? null : (typeof raw.currency === "string" && /^[A-Z]{3,5}$/.test(raw.currency) ? raw.currency : undefined);
  if (company === null && raw.company !== undefined && raw.company !== null) return null;
  if (currency === undefined) return null;
  const money = (value: unknown) => (value === undefined || value === null ? null : finite(value));
  const offset = raw.server_offset_minutes === undefined || raw.server_offset_minutes === null ? null : int(raw.server_offset_minutes, -14 * 60);
  if (offset !== null && offset > 14 * 60) return null;
  if (raw.server_offset_minutes !== undefined && raw.server_offset_minutes !== null && offset === null) return null;
  const weeks = raw.week_starts === undefined ? [] : raw.week_starts;
  if (!Array.isArray(weeks) || weeks.length > MAX_WEEK_STARTS) return null;
  const weekStarts = weeks.map(timeMs);
  if (weekStarts.some(value => value === null)) return null;
  const balance = money(raw.balance), equity = money(raw.equity);
  if ((raw.balance !== undefined && raw.balance !== null && balance === null) || (raw.equity !== undefined && raw.equity !== null && equity === null)) return null;
  return { server, login, company, trade_mode: tradeMode, currency, balance, equity, server_offset_minutes: offset, week_starts: weekStarts as number[] };
}

export function parseHeartbeat(body: unknown): Heartbeat | null {
  if (!isRow(body) || !onlyKeys(body, ["bridge_version", "terminals"])) return null;
  const version = typeof body.bridge_version === "string" && /^\d{1,4}\.\d{1,4}\.\d{1,6}$/.test(body.bridge_version) ? body.bridge_version : null;
  if (!version || !Array.isArray(body.terminals) || body.terminals.length > MAX_TERMINALS) return null;
  const terminals = body.terminals.map(parseTerminal);
  if (terminals.some(terminal => terminal === null)) return null;
  const list = terminals as HeartbeatTerminal[];
  if (new Set(list.map(terminal => `${terminal.server.toLowerCase()}|${terminal.login}`)).size !== list.length) return null;
  return { bridge_version: version, terminals: list };
}

const DEAL_KEYS = ["ticket", "order", "position_id", "time_msc", "type", "entry", "symbol", "volume", "price", "profit", "commission", "swap", "fee", "reason", "magic"] as const;
function parseDeal(raw: unknown): Mt5Deal | null {
  if (!isRow(raw) || !onlyKeys(raw, DEAL_KEYS)) return null;
  const ticket = int(raw.ticket, 1), order = int(raw.order), position = int(raw.position_id), time = timeMs(raw.time_msc);
  const type = int(raw.type), entry = int(raw.entry), reason = int(raw.reason);
  const symbol = raw.symbol === "" ? "" : printable(raw.symbol, 40);
  const volume = finite(raw.volume), price = finite(raw.price), profit = finite(raw.profit);
  const commission = finite(raw.commission ?? 0), swap = finite(raw.swap ?? 0), fee = finite(raw.fee ?? 0);
  if (raw.magic !== undefined && int(raw.magic) === null) return null;
  if (ticket === null || order === null || position === null || time === null || type === null || type > 20 || entry === null || entry > 3 || reason === null || reason > 20) return null;
  if (symbol === null || volume === null || volume < 0 || price === null || price < 0 || profit === null || commission === null || swap === null || fee === null) return null;
  return { ticket, order, position_id: position, time_msc: time, type, entry, symbol, volume, price, profit, commission, swap, fee, reason };
}

const ORDER_KEYS = ["ticket", "position_id", "time_setup_msc", "sl", "tp"] as const;
function parseOrder(raw: unknown): Mt5Order | null {
  if (!isRow(raw) || !onlyKeys(raw, ORDER_KEYS)) return null;
  const ticket = int(raw.ticket, 1), position = int(raw.position_id), time = timeMs(raw.time_setup_msc);
  const sl = finite(raw.sl ?? 0), tp = finite(raw.tp ?? 0);
  if (ticket === null || position === null || time === null || sl === null || sl < 0 || tp === null || tp < 0) return null;
  return { ticket, position_id: position, time_setup_msc: time, sl, tp };
}

export function parseDealsBatch(body: unknown): DealsBatch | null {
  if (!isRow(body) || !onlyKeys(body, ["account", "deals", "orders"]) || !isRow(body.account) || !onlyKeys(body.account, ["server", "login"])) return null;
  const server = parseServer(body.account.server), login = parseLogin(body.account.login);
  const orders = body.orders === undefined ? [] : body.orders;
  if (!server || !login || !Array.isArray(body.deals) || !Array.isArray(orders)) return null;
  if (body.deals.length > MAX_DEALS_PER_BATCH || orders.length > MAX_ORDERS_PER_BATCH) return null;
  const deals = body.deals.map(parseDeal), parsedOrders = orders.map(parseOrder);
  if (deals.some(deal => deal === null) || parsedOrders.some(order => order === null)) return null;
  return { account: { server, login }, deals: deals as Mt5Deal[], orders: parsedOrders as Mt5Order[] };
}
