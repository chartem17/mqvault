import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { generateKeyPairSync, sign as nodeSign } from "node:crypto";
const require = createRequire(import.meta.url);
const dir = "../.tmp-bridge-tests/lib";
const sig = require(`${dir}/bridge/signature.js`);
const pairing = require(`${dir}/bridge/pairing.js`);
const clock = require(`${dir}/bridge/broker-clock.js`);
const build = require(`${dir}/bridge/deals-to-trades.js`);
const sync = require(`${dir}/bridge/trade-sync.js`);
const match = require(`${dir}/bridge/account-match.js`);
const payload = require(`${dir}/bridge/device-payload.js`);
const tz = require(`${dir}/time/timezone.js`);

const NY7 = tz.FX_NY7_ZONE;
const wall = (text) => Date.parse(`${text}Z`); // MT5 server wall time as it arrives: wall clock disguised as UTC

// ---------- signature ----------
function deviceKey() {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  return { privateKey, spki: publicKey.export({ type: "spki", format: "der" }).toString("base64") };
}

test("a request signed with the device key verifies; any change to it does not", async () => {
  const { privateKey, spki } = deviceKey();
  const body = JSON.stringify({ deals: [] });
  const canonical = sig.canonicalString("post", "/api/bridge/device/deals", 1762600000000, 7, await sig.sha256Hex(body));
  assert.equal(canonical.split("\n")[0], "mqv-bridge-v1");
  assert.equal(canonical.split("\n")[1], "POST");
  const der = nodeSign("sha256", Buffer.from(canonical), { key: privateKey, dsaEncoding: "der" });
  const raw = nodeSign("sha256", Buffer.from(canonical), { key: privateKey, dsaEncoding: "ieee-p1363" });
  assert.equal(await sig.verifySignature(spki, canonical, new Uint8Array(der)), true, "DER signature (Python cryptography)");
  assert.equal(await sig.verifySignature(spki, canonical, new Uint8Array(raw)), true, "raw r||s signature");
  assert.equal(await sig.verifySignature(spki, canonical.replace("\n7\n", "\n8\n"), new Uint8Array(der)), false, "other seq");
  assert.equal(await sig.verifySignature(spki, canonical.replace("deals", "heartbeat"), new Uint8Array(der)), false, "other path");
  assert.equal(await sig.verifySignature(deviceKey().spki, canonical, new Uint8Array(der)), false, "other device key");
  const broken = new Uint8Array(der); broken[broken.length - 1] ^= 1;
  assert.equal(await sig.verifySignature(spki, canonical, broken), false, "flipped bit");
});

test("only P-256 SPKI public keys are accepted", async () => {
  assert.ok(await sig.importPublicKey(deviceKey().spki));
  const p384 = generateKeyPairSync("ec", { namedCurve: "P-384" }).publicKey.export({ type: "spki", format: "der" }).toString("base64");
  assert.equal(await sig.importPublicKey(p384), null);
  const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 }).publicKey.export({ type: "spki", format: "der" }).toString("base64");
  assert.equal(await sig.importPublicKey(rsa), null);
  assert.equal(await sig.importPublicKey("not base64!"), null);
  assert.equal((await sig.keyFingerprint(deviceKey().spki)).length, 64);
});

test("signature headers are parsed strictly and the clock window is ±5 minutes", () => {
  const headers = (values) => (name) => values[name] ?? null;
  const ok = { "x-mqv-device": "8C1F2A3B-0000-4000-8000-000000000001", "x-mqv-seq": "42", "x-mqv-time": "1762600000000", "x-mqv-sig": "AAAA" };
  const parsed = sig.parseSignedHeaders(headers(ok));
  assert.equal(parsed.device, "8c1f2a3b-0000-4000-8000-000000000001");
  assert.equal(parsed.seq, 42);
  assert.equal(sig.parseSignedHeaders(headers({ ...ok, "x-mqv-sig": undefined })), "missing");
  for (const bad of [{ "x-mqv-seq": "0" }, { "x-mqv-seq": "-1" }, { "x-mqv-seq": "1e3" }, { "x-mqv-time": "1762600000" }, { "x-mqv-device": "abc" }, { "x-mqv-sig": "@@@" }]) {
    assert.equal(sig.parseSignedHeaders(headers({ ...ok, ...bad })), "malformed", JSON.stringify(bad));
  }
  assert.equal(sig.clockSkewOk(1_000_000, 1_000_000 + 5 * 60_000), true);
  assert.equal(sig.clockSkewOk(1_000_000, 1_000_000 + 5 * 60_000 + 1), false);
});

test("only the device endpoints skip the browser session check", () => {
  assert.equal(sig.isDeviceSignedPath("/api/bridge/pairings", "POST"), true);
  assert.equal(sig.isDeviceSignedPath("/api/bridge/pairings/8c1f2a3b-0000-4000-8000-000000000001", "GET"), true);
  assert.equal(sig.isDeviceSignedPath("/api/bridge/device/deals", "POST"), true);
  assert.equal(sig.isDeviceSignedPath("/api/bridge/device/heartbeat", "POST"), true);
  assert.equal(sig.isDeviceSignedPath("/api/bridge/pairings/approve", "POST"), false, "approval needs the owner's session");
  assert.equal(sig.isDeviceSignedPath("/api/bridge/devices", "GET"), false);
  assert.equal(sig.isDeviceSignedPath("/api/bridge/device/deals", "GET"), false);
  assert.equal(sig.isDeviceSignedPath("/api/bridge/device/deals/", "POST"), false);
  assert.equal(sig.isDeviceSignedPath("/api/journal/trades", "POST"), false);
});

// ---------- pairing ----------
test("pairing codes use the unambiguous alphabet and are forgiving to type", () => {
  for (let index = 0; index < 200; index++) {
    const code = pairing.generateUserCode();
    assert.match(code, /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/);
  }
  assert.equal(pairing.CODE_ALPHABET.length, 32);
  assert.equal(pairing.normalizeUserCode(" k7q2-m9xd "), "K7Q2M9XD");
  assert.equal(pairing.normalizeUserCode("K7Q2 M9XD"), "K7Q2M9XD");
  assert.equal(pairing.normalizeUserCode("K7Q2-M9X0"), null, "0 is not in the alphabet");
  assert.equal(pairing.normalizeUserCode("K7Q2-M9X"), null);
  assert.equal(pairing.normalizeUserCode(12345678), null);
});

test("a pairing request has exactly the expected fields and printable labels", () => {
  const ok = { public_key: "QUJD", device_name: "DESKTOP-7F3‮", os: "Windows 11", bridge_version: "0.1.0", key_storage: "tpm" };
  assert.deepEqual(pairing.parsePairingRequest(ok), { ...ok, device_name: "DESKTOP-7F3" });
  assert.equal(pairing.parsePairingRequest({ ...ok, key_storage: undefined }).key_storage, "unknown");
  assert.equal(pairing.parsePairingRequest({ ...ok, login: "1" }), null, "extra field");
  assert.equal(pairing.parsePairingRequest({ ...ok, bridge_version: "latest" }), null);
  assert.equal(pairing.parsePairingRequest({ ...ok, device_name: "\u0000" }), null);
  assert.equal(pairing.parsePairingRequest([ok]), null);
});

test("pairing status follows approval, expiry and one-time collection", () => {
  const base = { expires_at: "2026-11-08T12:10:00.000Z", approved_at: null, device_id: null, consumed_at: null };
  const now = Date.parse("2026-11-08T12:05:00.000Z");
  assert.equal(pairing.pairingStatus(base, now), "pending");
  assert.equal(pairing.pairingStatus(base, Date.parse("2026-11-08T12:10:00.000Z")), "expired");
  assert.equal(pairing.pairingStatus({ ...base, approved_at: "x", device_id: "d" }, now), "approved");
  assert.equal(pairing.pairingStatus({ ...base, approved_at: "x", device_id: "d", consumed_at: "y" }, now), "consumed");
});

// ---------- broker clock ----------
test("the New York + 7 server zone follows US daylight-saving dates", () => {
  assert.equal(tz.zoneOffsetMinutes(Date.parse("2026-01-15T12:00:00Z"), NY7), 120);
  assert.equal(tz.zoneOffsetMinutes(Date.parse("2026-07-01T12:00:00Z"), NY7), 180);
  // 2026-03-16: US already on summer time (since Mar 8), Europe not yet (Mar 29) — NY+7 is +3, Kyiv is +2.
  assert.equal(tz.zoneOffsetMinutes(Date.parse("2026-03-16T12:00:00Z"), NY7), 180);
  assert.equal(tz.zoneOffsetMinutes(Date.parse("2026-03-16T12:00:00Z"), "Europe/Kyiv"), 120);
  assert.equal(tz.getOffsetLabel(NY7, new Date("2026-07-01T12:00:00Z")), "GMT+3");
  assert.equal(tz.isValidTimeZone(NY7), false, "never a user zone");
  assert.equal(tz.isValidBrokerTimeZone(NY7), true);
  assert.equal(tz.isValidBrokerTimeZone("Europe/Kyiv"), true);
  assert.equal(tz.fromZonedInputValue("2026-03-16T12:00", NY7), "2026-03-16T09:00:00.000Z");
  assert.equal(tz.toZonedInputValue("2026-03-16T09:00:00.000Z", NY7), "2026-03-16T12:00");
  assert.equal(tz.dayKey("2026-07-01T21:30:00.000Z", NY7), "2026-07-02", "daily candle rolls at 17:00 New York");
  assert.match(tz.formatDateTime("2026-03-16T09:00:00.000Z", NY7, "en-GB"), /12:00/);
});

test("server wall time becomes the right UTC instant, milliseconds included", () => {
  assert.equal(new Date(clock.serverWallToUtcMs(wall("2026-07-01T12:00:00.250"), NY7)).toISOString(), "2026-07-01T09:00:00.250Z");
  assert.equal(new Date(clock.serverWallToUtcMs(wall("2026-01-15T12:00:00"), NY7)).toISOString(), "2026-01-15T10:00:00.000Z");
  assert.equal(new Date(clock.serverWallToUtcMs(wall("2026-03-16T12:00:00"), "Europe/Kyiv")).toISOString(), "2026-03-16T10:00:00.000Z");
  assert.equal(new Date(clock.serverWallToUtcMs(wall("2026-03-16T12:00:00"), "Etc/UTC")).toISOString(), "2026-03-16T12:00:00.000Z");
});

/** First H1 bar of each week of 2026 as a server in `zone` would report it: Sunday 17:00 New York in that zone's wall time. */
function weekStarts(zone) {
  const starts = [];
  for (let day = Date.parse("2026-01-04T00:00:00Z"); day < Date.parse("2026-12-27T00:00:00Z"); day += 7 * 86_400_000) {
    const open = tz.zonedWallTime(new Date(day).toISOString().slice(0, 10), "17:00", "America/New_York");
    starts.push(open + tz.zoneOffsetMinutes(open, zone) * 60_000);
  }
  return starts;
}

test("the broker zone is recognised from weekly first bars", () => {
  const ny7 = clock.weeklyOffsets(weekStarts(NY7));
  assert.equal(ny7.length, 51);
  assert.ok(ny7.every(week => week.offsetMinutes === 120 || week.offsetMinutes === 180));
  assert.deepEqual(clock.suggestBrokerZone(ny7), { zone: NY7, matched: 51, weeks: 51 });
  const kyiv = clock.suggestBrokerZone(clock.weeklyOffsets(weekStarts("Europe/Kyiv")));
  assert.equal(kyiv.zone, "Europe/Kyiv");
  assert.equal(clock.suggestBrokerZone(clock.weeklyOffsets(weekStarts("Etc/UTC"))).zone, "Etc/UTC");
  assert.equal(clock.suggestBrokerZone(ny7.slice(0, 3)), null, "too few weeks");
  const odd = clock.weeklyOffsets(weekStarts("Asia/Kolkata"));
  assert.equal(clock.suggestBrokerZone(odd), null, "no candidate explains a +5:30 server");
  assert.equal(clock.offsetDisagrees(NY7, 180, Date.parse("2026-03-16T12:00:00Z")), false);
  assert.equal(clock.offsetDisagrees("Europe/Kyiv", 180, Date.parse("2026-03-16T12:00:00Z")), true);
});

test("holiday weeks that open late do not break the match", () => {
  const starts = weekStarts(NY7);
  starts[0] += 3600_000; // New Year week opened an hour late
  starts[50] += 7 * 3600_000;
  assert.equal(clock.suggestBrokerZone(clock.weeklyOffsets(starts)).zone, NY7);
});

// ---------- deals → trades ----------
let ticket = 1000;
const deal = (fields) => ({ ticket: ++ticket, order: ticket + 500, position_id: 1, time_msc: wall("2026-07-01T10:00:00"), type: 0, entry: 0, symbol: "EURUSD.raw", volume: 1, price: 1.1, profit: 0, commission: 0, swap: 0, fee: 0, reason: 0, ...fields });

test("a simple position becomes one closed trade with costs, broker times in UTC and the initial stop", () => {
  const open = deal({ ticket: 11, order: 21, commission: -3.5, price: 1.1 });
  const close = deal({ ticket: 12, order: 22, entry: 1, type: 1, price: 1.102, profit: 200, commission: -3.5, swap: -1.2, reason: 5, time_msc: wall("2026-07-01T14:30:00") });
  const orders = [{ ticket: 21, position_id: 1, time_setup_msc: open.time_msc, sl: 1.098, tp: 1.102 }, { ticket: 22, position_id: 1, time_setup_msc: close.time_msc, sl: 0, tp: 0 }];
  const balance = { ...deal({ type: 2, position_id: 0, profit: 10000 }) };
  const [trade, ...rest] = build.buildTrades([close, balance, open], orders, NY7);
  assert.equal(rest.length, 0, "balance deal is not a trade");
  assert.deepEqual(trade, {
    key: "1", position_id: 1, segment: 1, symbol: "EURUSD", raw_symbol: "EURUSD.raw", direction: "Long",
    opened_at: "2026-07-01T07:00:00.000Z", closed_at: "2026-07-01T11:30:00.000Z",
    entry_price: 1.1, exit_price: 1.102, volume: 1, stop_loss: 1.098, take_profit: 1.102,
    gross_pnl: 200, commission: 7, swap: -1.2, fee: 0, close_reason: "tp", deal_count: 2,
  });
});

test("scaling in and partial exits are volume-weighted; an unfinished position stays open", () => {
  const deals = [
    deal({ position_id: 5, type: 1, volume: 1, price: 2000, time_msc: wall("2026-07-02T09:00:00"), symbol: "XAUUSD" }),
    deal({ position_id: 5, type: 1, volume: 3, price: 2004, time_msc: wall("2026-07-02T09:05:00"), symbol: "XAUUSD" }),
    deal({ position_id: 5, type: 0, entry: 1, volume: 2, price: 1990, profit: 2000, time_msc: wall("2026-07-02T10:00:00"), symbol: "XAUUSD" }),
  ];
  let [trade] = build.buildTrades(deals, [], NY7);
  assert.equal(trade.direction, "Short");
  assert.equal(trade.entry_price, 2003);
  assert.equal(trade.volume, 4);
  assert.equal(trade.closed_at, null, "2 of 4 lots still open");
  assert.equal(trade.close_reason, null);
  deals.push(deal({ position_id: 5, type: 0, entry: 1, volume: 2, price: 1996, profit: 1400, reason: 4, time_msc: wall("2026-07-02T11:00:00"), symbol: "XAUUSD" }));
  [trade] = build.buildTrades(deals, [], NY7);
  assert.equal(trade.exit_price, 1993);
  assert.equal(trade.gross_pnl, 3400);
  assert.equal(trade.close_reason, "sl");
  assert.equal(trade.closed_at, "2026-07-02T08:00:00.000Z");
});

test("a reversal on a netting account closes one trade and opens the opposite one", () => {
  const deals = [
    deal({ position_id: 9, type: 0, volume: 1, price: 100, order: 1, time_msc: wall("2026-07-03T09:00:00"), symbol: "US30.cash" }),
    deal({ position_id: 9, type: 1, entry: 2, volume: 3, price: 110, profit: 10, order: 2, time_msc: wall("2026-07-03T10:00:00"), symbol: "US30.cash" }),
    deal({ position_id: 9, type: 0, entry: 1, volume: 2, price: 105, profit: 10, order: 3, time_msc: wall("2026-07-03T11:00:00"), symbol: "US30.cash" }),
  ];
  const orders = [{ ticket: 1, position_id: 9, time_setup_msc: deals[0].time_msc, sl: 95, tp: 0 }, { ticket: 2, position_id: 9, time_setup_msc: deals[1].time_msc, sl: 115, tp: 90 }];
  const [first, second] = build.buildTrades(deals, orders, "Etc/UTC");
  assert.equal(first.key, "9");
  assert.equal(first.direction, "Long");
  assert.equal(first.exit_price, 110);
  assert.equal(first.stop_loss, 95);
  assert.equal(second.key, "9:2");
  assert.equal(second.symbol, "US30");
  assert.equal(second.direction, "Short");
  assert.equal(second.volume, 2);
  assert.equal(second.entry_price, 110);
  assert.equal(second.exit_price, 105);
  assert.equal(second.stop_loss, 115);
  assert.equal(second.take_profit, 90);
  assert.equal(second.opened_at, "2026-07-03T10:00:00.000Z");
});

test("an exit whose entry is outside the history still becomes a trade without an entry price", () => {
  const [trade] = build.buildTrades([deal({ position_id: 77, type: 1, entry: 1, profit: -50, volume: 0.5 })], [], NY7);
  assert.equal(trade.direction, "Long");
  assert.equal(trade.entry_price, null);
  assert.equal(trade.volume, 0.5);
  assert.equal(trade.close_reason, "manual");
});

// ---------- sync plan ----------
const built = (key, fields = {}) => ({ key, position_id: Number(key), segment: 1, symbol: "EURUSD", raw_symbol: "EURUSD.raw", direction: "Long", opened_at: "2026-07-01T07:00:00.000Z", closed_at: "2026-07-01T11:30:00.000Z", entry_price: 1.1, exit_price: 1.102, volume: 1, stop_loss: 1.098, take_profit: null, gross_pnl: 200, commission: 7, swap: 0, fee: 0, close_reason: "tp", deal_count: 2, ...fields });
const journalRow = (id, fields = {}) => ({ id, ticket: null, external_id: null, symbol: "EURUSD", direction: "Long", opened_at: "2026-07-01T07:00:20.000Z", entry_price: "1.10003", stop_loss: null, take_profit: null, ...fields });

test("sync inserts new trades, updates linked ones and never revives a deleted one", () => {
  const plan = sync.planSync(
    [built("1"), built("2"), built("3"), built("4", { opened_at: "2026-07-05T07:00:00.000Z" })],
    [{ key: "1", trade_id: "t1", synced_at: "x" }, { key: "2", trade_id: null, synced_at: "x" }],
    [journalRow("t1", { ticket: "1", stop_loss: "1.0975" }), journalRow("t3"), journalRow("t9", { ticket: "999", opened_at: "2026-07-05T07:00:00.000Z" })],
  );
  assert.deepEqual(plan.skippedDeleted, ["2"]);
  assert.deepEqual(plan.updates.map(update => [update.trade.key, update.trade_id]), [["1", "t1"], ["3", "t3"]]);
  assert.equal(plan.updates[0].patch.stop_loss, undefined, "owner's stop is kept");
  assert.equal(plan.updates[1].patch.stop_loss, 1.098, "an empty stop is filled");
  assert.equal(plan.updates[1].patch.ticket, "3");
  assert.equal("setup" in plan.updates[1].patch || "notes" in plan.updates[1].patch || "meta" in plan.updates[1].patch, false);
  assert.deepEqual(plan.inserts.map(insert => insert.trade.key), ["4"], "a trade that already has another ticket is not taken over");
});

test("a CSV-imported trade with the same ticket is attached, and each journal trade is used once", () => {
  const plan = sync.planSync([built("7"), built("8")], [], [journalRow("a", { ticket: "7", symbol: "EURUSD.raw" }), journalRow("b", { entry_price: 1.2 })]);
  assert.deepEqual(plan.updates.map(update => update.trade_id), ["a"]);
  assert.deepEqual(plan.inserts.map(insert => insert.trade.key), ["8"], "price differs too much to be the same trade");
});

// ---------- account match ----------
test("an MT5 login is matched to one account, created when unknown, and ambiguity is reported", () => {
  const accounts = [
    { id: "a", platform: "mt5", mt5_login: "5100123", mt5_server: "ACGMarkets-Main" },
    { id: "b", platform: "mt5", mt5_login: "777", mt5_server: null },
    { id: "c", platform: "mt5", mt5_login: "888", mt5_server: "X" },
    { id: "d", platform: "mt5", mt5_login: "888", mt5_server: "x " },
  ];
  assert.deepEqual(match.matchAccount({ login: "5100123", server: "acgmarkets-main" }, accounts), { kind: "matched", account_id: "a" });
  assert.deepEqual(match.matchAccount({ login: "777", server: "Any-Demo" }, accounts), { kind: "matched", account_id: "b" });
  assert.deepEqual(match.matchAccount({ login: "888", server: "X" }, accounts), { kind: "ambiguous", account_ids: ["c", "d"] });
  assert.deepEqual(match.matchAccount({ login: "5100123", server: "Other-Live" }, accounts), { kind: "create" });
  assert.equal(match.autoAccountName("ACG Markets", "5100123"), "ACG Markets · 5100123");
  assert.equal(match.autoAccountName(null, "1"), "MT5 · 1");
  assert.equal(match.terminalAccountState({ account_id: null, matched_at: null }), "new");
  assert.equal(match.terminalAccountState({ account_id: "a", matched_at: "x" }), "linked");
  assert.equal(match.terminalAccountState({ account_id: null, matched_at: "x" }), "ignored", "account deleted by the owner");
});

// ---------- device payloads ----------
const terminal = { server: "ACGMarkets-Main", login: "5100123", company: "ACG Markets", trade_mode: "demo", currency: "USD", balance: 99480.12, equity: 99480.12, server_offset_minutes: 120, week_starts: [wall("2026-11-02T00:00:00")] };

test("heartbeats are accepted only in the exact expected shape", () => {
  assert.deepEqual(payload.parseHeartbeat({ bridge_version: "0.1.0", terminals: [terminal] }).terminals[0], terminal);
  assert.ok(payload.parseHeartbeat({ bridge_version: "0.1.0", terminals: [] }));
  for (const bad of [
    { ...terminal, name: "Owner Name" }, { ...terminal, login: "51 00" }, { ...terminal, trade_mode: "prop" }, { ...terminal, balance: "1" },
    { ...terminal, week_starts: [1762560000] }, { ...terminal, server_offset_minutes: 15 * 60 }, { ...terminal, currency: "usd" },
  ]) assert.equal(payload.parseHeartbeat({ bridge_version: "0.1.0", terminals: [bad] }), null, JSON.stringify(bad));
  assert.equal(payload.parseHeartbeat({ bridge_version: "0.1.0", terminals: [terminal, terminal] }), null, "duplicate account");
  assert.equal(payload.parseHeartbeat({ bridge_version: "0.1.0", terminals: [terminal], command: "x" }), null);
});

test("deal batches are bounded and strictly typed", () => {
  const raw = { ticket: 11, order: 21, position_id: 1, time_msc: wall("2026-07-01T10:00:00"), type: 0, entry: 0, symbol: "EURUSD.raw", volume: 1, price: 1.1, profit: 0, commission: -3.5, swap: 0, fee: 0, reason: 0, magic: 0 };
  const order = { ticket: 21, position_id: 1, time_setup_msc: raw.time_msc, sl: 1.098, tp: 0 };
  const ok = payload.parseDealsBatch({ account: { server: "ACGMarkets-Main", login: "5100123" }, deals: [raw], orders: [order] });
  assert.equal(ok.deals.length, 1);
  assert.equal("magic" in ok.deals[0], false, "not stored");
  assert.equal(payload.parseDealsBatch({ account: { server: "S", login: "1" }, deals: [{ ...raw, comment: "[sl 1.0980]" }] }), null, "comments are not synced (owner's decision)");
  assert.equal(payload.parseDealsBatch({ account: { server: "S", login: "1" }, deals: [{ ...raw, time_msc: 1751364000 }] }), null, "seconds instead of ms");
  assert.equal(payload.parseDealsBatch({ account: { server: "S", login: "1" }, deals: Array(1001).fill(raw) }), null);
  assert.equal(payload.parseDealsBatch({ account: { server: "S", login: "1", password: "x" }, deals: [] }), null);
});

// ---------- cross-language vector (bridge/app/tests/vector.json, produced by the Python Bridge) ----------
test("a request signed by the Python Bridge verifies on the server", async () => {
  const { readFileSync } = await import("node:fs");
  const vector = JSON.parse(readFileSync(new URL("../bridge/app/tests/vector.json", import.meta.url), "utf8"));
  const canonical = sig.canonicalString(vector.method, vector.path, vector.time_ms, vector.seq, await sig.sha256Hex(vector.body));
  assert.equal(canonical, vector.canonical);
  const signature = Uint8Array.from(Buffer.from(vector.signature_der, "base64"));
  assert.equal(await sig.verifySignature(vector.public_key, canonical, signature), true);
  assert.equal(await sig.verifySignature(vector.public_key, canonical.replace("heartbeat", "deals"), signature), false);
  const headers = sig.parseSignedHeaders(name => ({ "x-mqv-device": "8c1f2a3b-0000-4000-8000-000000000001", "x-mqv-seq": String(vector.seq), "x-mqv-time": String(vector.time_ms), "x-mqv-sig": vector.signature_der })[name] ?? null);
  assert.equal(headers.seq, vector.seq, "microsecond-based seq fits the header format");
});
