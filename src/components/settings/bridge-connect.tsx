"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button, Input, Panel } from "@/components/ui/primitives";
import { useI18n } from "@/components/providers/i18n-provider";
import { useTimezone } from "@/components/providers/timezone-provider";
import { LanguageToggle } from "@/components/settings/language-toggle";
import { formatDateTimeOrDash } from "@/lib/time/timezone";
import { msg } from "@/lib/i18n/core";

type DevicePreview = { name: string; os: string; bridge_version: string; key_storage: string };
type Device = { id: string; name: string; os: string; key_storage: string; bridge_version: string | null; last_seen_at: string | null; last_sync_at: string | null; revoked_at: string | null; created_at: string };
type TerminalAccount = { id: string; device_id: string | null; server: string; login: string; company: string | null; trade_mode: string; account_id: string | null; matched_at: string | null; needs_review: boolean; last_sync_at: string | null };

const ERRORS: Record<string, string> = {
  invalid_code: msg("This code is not valid or has expired. Check it in the MQVault Bridge window, or restart Bridge to get a new one."),
  rate_limited: msg("Too many attempts. Wait 15 minutes and try again."),
  key_already_paired: msg("This computer is already connected."),
  unavailable: msg("The server is not available right now. Try again in a minute."),
};
const KEY_STORAGE: Record<string, string> = { tpm: msg("TPM chip"), cng: msg("Windows key storage"), dpapi: msg("Encrypted for this Windows user"), unknown: msg("Unknown") };

async function call(code: string, confirm: boolean) {
  const response = await fetch("/api/bridge/pairings/approve", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ user_code: code, confirm }) });
  const body = await response.json().catch(() => null) as { device?: DevicePreview & { id?: string }; error?: string } | null;
  return { ok: response.ok, device: body?.device ?? null, error: body?.error ?? "unavailable" };
}

/** Owner confirms that the PC showing this code may write trades into the journal (docs/features/mt5-bridge.md §3.2). */
export function BridgeConnect({ initialCode }: { initialCode: string }) {
  const { t, intl } = useI18n();
  const { timezone } = useTimezone();
  const [code, setCode] = useState(initialCode);
  const [preview, setPreview] = useState<DevicePreview | null>(null);
  const [connected, setConnected] = useState<DevicePreview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [accounts, setAccounts] = useState<TerminalAccount[]>([]);

  const load = useCallback(async () => {
    const response = await fetch("/api/bridge/devices", { credentials: "same-origin" }).catch(() => null);
    if (!response?.ok) { setDevices(current => current ?? []); return; }
    const body = await response.json() as { devices: Device[]; accounts: TerminalAccount[] };
    setDevices(body.devices); setAccounts(body.accounts);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const check = useCallback(async (value: string) => {
    setBusy(true); setError(""); setPreview(null);
    try {
      const result = await call(value, false);
      if (result.ok && result.device) setPreview(result.device); else setError(ERRORS[result.error] ?? ERRORS.unavailable);
    } catch { setError(ERRORS.unavailable); }
    setBusy(false);
  }, []);
  useEffect(() => { if (initialCode) void check(initialCode); }, [initialCode, check]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!busy && code.trim()) await check(code);
  }
  async function confirm() {
    setBusy(true); setError("");
    try {
      const result = await call(code, true);
      if (result.ok && result.device) { setConnected(result.device); setPreview(null); void load(); } else setError(ERRORS[result.error] ?? ERRORS.unavailable);
    } catch { setError(ERRORS.unavailable); }
    setBusy(false);
  }
  async function revoke(device: Device) {
    if (!window.confirm(t("Disconnect {name}? It will stop sending trades. Trades already in the journal stay.", { name: device.name }))) return;
    const response = await fetch(`/api/bridge/devices?id=${encodeURIComponent(device.id)}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, credentials: "same-origin" }).catch(() => null);
    if (!response?.ok) setError(t("Could not disconnect the computer."));
    void load();
  }

  const when = (iso: string | null) => formatDateTimeOrDash(iso, timezone, intl);
  const active = (devices ?? []).filter(device => !device.revoked_at);

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 px-4 py-8 sm:py-12">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">← {t("Back to the journal")}</Link>
        <LanguageToggle />
      </div>

      <Panel className="space-y-4 p-5 sm:p-6">
        <div>
          <h1 className="text-lg font-semibold">{t("Connect a computer to MQVault")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("MQVault Bridge on your PC shows an 8-character code. Confirm it here only if you started Bridge yourself on that computer.")}</p>
        </div>

        {connected ? (
          <div role="status" className="rounded-xl border border-border bg-background p-4 text-sm">
            <p className="font-medium">{t("{name} is connected.", { name: connected.name })}</p>
            <p className="mt-1 text-muted-foreground">{t("Bridge will find your running MetaTrader 5 terminals and sync trades within a minute. You can close this page.")}</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">{t("Code from the Bridge window")}</span>
              <Input value={code} onChange={event => { setCode(event.target.value.toUpperCase()); setPreview(null); }} placeholder="K7Q2-M9XD" autoComplete="off" autoCapitalize="characters" spellCheck={false} inputMode="text" maxLength={12} aria-invalid={!!error || undefined} className="font-mono text-base tracking-[0.2em]" />
            </label>
            {!preview && <Button type="submit" loading={busy} disabled={!code.trim()} className="w-full sm:w-auto">{t("Check code")}</Button>}
          </form>
        )}

        {preview && !connected && (
          <div className="space-y-3 rounded-xl border border-border bg-background p-4">
            <p className="text-sm font-medium">{t("This computer asks for access:")}</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">{t("Computer")}</dt><dd className="break-all font-medium">{preview.name}</dd>
              <dt className="text-muted-foreground">{t("System")}</dt><dd>{preview.os}</dd>
              <dt className="text-muted-foreground">{t("Bridge version")}</dt><dd>{preview.bridge_version}</dd>
              <dt className="text-muted-foreground">{t("Device key")}</dt><dd>{t(KEY_STORAGE[preview.key_storage] ?? KEY_STORAGE.unknown)}</dd>
            </dl>
            <p className="text-xs text-muted-foreground">{t("It will be able to add and update trades of your MT5 accounts. It cannot read anything else, trade or change settings.")}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={confirm} loading={busy}>{t("Connect this computer")}</Button>
              <Button variant="ghost" onClick={() => { setPreview(null); setCode(""); }}>{t("Cancel")}</Button>
            </div>
          </div>
        )}

        {error && <p role="alert" className="text-sm text-destructive">{t(error)}</p>}
      </Panel>

      <Panel className="space-y-3 p-5 sm:p-6">
        <h2 className="text-sm font-semibold">{t("Connected computers")}</h2>
        {devices === null ? (
          <p className="text-sm text-muted-foreground">{t("Loading…")}</p>
        ) : active.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("No computers connected yet.")}</p>
        ) : (
          <ul className="space-y-3">
            {active.map(device => {
              const own = accounts.filter(account => account.device_id === device.id);
              return (
                <li key={device.id} className="rounded-xl border border-border bg-background p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-all font-medium">{device.name}</p>
                      <p className="text-xs text-muted-foreground">{t("Last seen: {when}", { when: when(device.last_seen_at) })} · {t("Last sync: {when}", { when: when(device.last_sync_at) })}</p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => revoke(device)}>{t("Disconnect")}</Button>
                  </div>
                  {own.length > 0 && (
                    <ul className="mt-2 space-y-1 border-t border-border pt-2 text-xs">
                      {own.map(account => (
                        <li key={account.id} className="flex flex-wrap justify-between gap-2">
                          <span className="break-all">{account.company ? `${account.company} · ` : ""}{account.server} · {account.login}</span>
                          <span className="text-muted-foreground">{account.account_id ? (account.needs_review ? t("Synced · check the account type") : t("Synced")) : account.matched_at ? t("Not synced (account removed)") : t("Waiting")}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </main>
  );
}
