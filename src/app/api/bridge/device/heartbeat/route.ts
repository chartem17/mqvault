import { authenticateDevice, json, parseJson, syncPositions } from "@/lib/bridge/server";
import { parseHeartbeat, type HeartbeatTerminal } from "@/lib/bridge/device-payload";
import { autoAccountName, matchAccount, terminalAccountState } from "@/lib/bridge/account-match";
import { suggestBrokerZone, weeklyOffsets } from "@/lib/bridge/broker-clock";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Status = "linked" | "waiting" | "ignored";

/** Zone for an automatically created account: weekly bars first, else a whole-hour live offset, else unknown. */
function zoneFor(terminal: HeartbeatTerminal): string | null {
  const suggestion = suggestBrokerZone(weeklyOffsets(terminal.week_starts));
  if (suggestion) return suggestion.zone;
  const offset = terminal.server_offset_minutes;
  if (offset === null || offset % 60 !== 0) return null;
  return offset === 0 ? "Etc/UTC" : `Etc/GMT${offset > 0 ? "-" : "+"}${Math.abs(offset / 60)}`;
}

/**
 * POST { bridge_version, terminals: [...] } → { accounts: [{ server, login, status }] }
 * Status of the PC and its MT5 accounts once a minute. An account seen for the first time is linked to the journal
 * account with the same login/server, or created (personal, flagged for the owner to review on Home — owner's
 * decision 2026-11-08). The response carries only status words: the server never sends the PC commands.
 */
export async function POST(request: Request) {
  const context = await authenticateDevice(request);
  if (context instanceof Response) return context;
  const { db, device, body } = context;
  const heartbeat = parseHeartbeat(parseJson(body));
  if (!heartbeat) return json({ error: "invalid_request" }, 400);
  const now = new Date().toISOString();
  await db.from("bridge_devices").update({ bridge_version: heartbeat.bridge_version }).eq("id", device.id);

  const accounts: { server: string; login: string; status: Status }[] = [];
  for (const terminal of heartbeat.terminals) {
    const offsets = weeklyOffsets(terminal.week_starts);
    const zone = zoneFor(terminal);
    const { data: row, error } = await db.from("bridge_terminal_accounts").upsert({
      user_id: device.user_id, device_id: device.id, server: terminal.server, login: terminal.login, company: terminal.company,
      trade_mode: terminal.trade_mode, currency: terminal.currency, balance: terminal.balance, equity: terminal.equity, last_seen_at: now, updated_at: now,
      ...(offsets.length ? { week_offsets: offsets.slice(-52), detected_zone: zone } : {}),
      ...(terminal.server_offset_minutes !== null ? { server_offset_minutes: terminal.server_offset_minutes, offset_measured_at: now } : {}),
    }, { onConflict: "user_id,server,login" }).select("id, account_id, matched_at, ignored_at, detected_zone").single();
    if (error || !row) return json({ error: "unavailable" }, 503);

    const state = terminalAccountState(row);
    if (state !== "new") { accounts.push({ server: terminal.server, login: terminal.login, status: state === "linked" ? "linked" : "ignored" }); continue; }

    const { data: journalAccounts } = await db.from("accounts").select("id, platform, mt5_login, mt5_server").eq("user_id", device.user_id);
    const match = matchAccount(terminal, journalAccounts ?? []);
    let accountId: string | null = match.kind === "matched" ? match.account_id : null;
    if (match.kind === "create" && zone) {
      const { data: created } = await db.from("accounts").insert({
        user_id: device.user_id, name: autoAccountName(terminal.company, terminal.login), broker: terminal.company, platform: "mt5", account_type: "personal",
        currency: terminal.currency === "USDT" ? "USDT" : "USD", mt5_login: terminal.login, mt5_server: terminal.server, broker_timezone: zone, color: "#4f8cff",
      }).select("id").single();
      accountId = created?.id ?? null;
    }
    if (!accountId) {
      // Ambiguous match, or the server zone is not known yet: deals are stored but not written to the journal.
      await db.from("bridge_terminal_accounts").update({ needs_review: true }).eq("id", row.id);
      accounts.push({ server: terminal.server, login: terminal.login, status: "waiting" });
      continue;
    }
    const { data: linked } = await db.from("bridge_terminal_accounts")
      .update({ account_id: accountId, matched_at: now, needs_review: match.kind === "create" })
      .eq("id", row.id).is("matched_at", null).select("id").maybeSingle();
    if (linked) {
      // Deals that arrived before the account was linked are written to the journal now; a failure is retried by the next deals batch.
      try { await syncPositions(db, { id: row.id, user_id: device.user_id, account_id: accountId }, "all"); } catch { /* raw deals are kept */ }
    }
    accounts.push({ server: terminal.server, login: terminal.login, status: "linked" });
  }
  return json({ accounts, server_time: Date.now() });
}
