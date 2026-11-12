"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowLeft, Download, EyeOff, SlidersHorizontal, KeyRound, Languages, LogOut, MonitorSmartphone, Moon, Palette, ShieldCheck, Sun, Trash2, UserRound } from "lucide-react";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useTrades } from "@/hooks/use-trades";
import { formatNumber } from "@/lib/journal/number-format";


const START_TAB_OPTIONS = [
  { id: "home", label: msg("Home"), ownerOnly: false },
  { id: "overview", label: msg("Overview"), ownerOnly: false },
  { id: "journal", label: msg("Journal"), ownerOnly: false },
  { id: "strategy-control", label: msg("Strategy control"), ownerOnly: false },
  { id: "calendar", label: msg("Calendar"), ownerOnly: true },
] as const;
import { Button, Input, Panel, Select } from "@/components/ui/primitives";
import { PasswordStrength } from "@/components/ui/otp-input";
import { Switch } from "@/components/ui/switch";
import { TimezoneSelect } from "@/components/settings/timezone-select";
import { useTimezone } from "@/components/providers/timezone-provider";
import { useI18n } from "@/components/providers/i18n-provider";
import { useProfile } from "@/components/providers/profile-provider";
import { LOCALE_LABEL, LOCALES, isLocale, msg } from "@/lib/i18n/core";
import { PASSWORD_MIN_LENGTH as PASSWORD_MIN } from "@/lib/auth/request-guard";
import { passwordStrength } from "@/lib/auth/password-strength";
import { formatDateTimeOrDash } from "@/lib/time/timezone";

type ActivityRow = { id: number; action: string; method: string | null; detail: Record<string, unknown>; ip_hash: string | null; user_agent: string | null; created_at: string };
/** What each security event is called on screen. */
const ACTIVITY_LABEL: Record<string, string> = {
  sign_in: msg("Signed in"), password_changed: msg("Password changed"), sign_out_everywhere: msg("Signed out on other devices"),
  data_exported: msg("Data exported"), account_deleted: msg("Trading account deleted"), strategy_deleted: msg("Strategy deleted"),
  bridge_device_connected: msg("Computer connected to MT5 Bridge"), bridge_device_revoked: msg("Computer disconnected from MT5 Bridge"),
};
const METHOD_LABEL: Record<string, string> = { password: msg("password"), code: msg("e-mail code"), google: "Google", email_link: msg("e-mail link"), reset_link: msg("reset link"), current_password: msg("with the current password") };
type SessionRow = { id: string; created_at: string; updated_at: string | null; user_agent: string | null; ip: string | null };

async function post(path: string, body?: Record<string, unknown>, method = "POST") {
  const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body ?? {}) });
  const data = await response.json().catch(() => null) as { error?: string; ok?: boolean; deleted?: boolean } | null;
  return { ok: response.ok, error: data?.error };
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return <Panel className="p-5 sm:p-6">
    <h2 className="flex items-center gap-2.5 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{icon}{title}</h2>
    <div className="mt-4">{children}</div>
  </Panel>;
}
function Toggle({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: (value: boolean) => void }) {
  return <div className="flex items-center justify-between gap-4">
    <div><div className="text-sm font-medium">{label}</div><p className="mt-0.5 text-xs text-muted-foreground">{hint}</p></div>
    <Switch aria-label={label} isSelected={on} onChange={onChange} />
  </div>;
}
const row = "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between";
const labelCls = "text-sm font-medium";
const hintCls = "mt-0.5 text-xs text-muted-foreground";

/** One place for appearance, language & time, security, MT5 Bridge and account deletion (package 2). */
export default function SettingsPage() {
  const { t, locale, setLocale } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();
  const { timezone, saving: zoneSaving, setTimezone } = useTimezone();
  const { profile, hasPassword, googleLinked, refresh } = useProfile();
  const [mounted, setMounted] = useState(false);
  const { preferences, update } = usePreferences();
  const { accounts } = useTrades();
  useEffect(() => { setMounted(true); }, []);

  // Security: password change
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordNote, setPasswordNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const strength = passwordStrength(next);
  const strengthLabel = [t("Use at least {count} characters", { count: PASSWORD_MIN }), t("Weak password"), t("Fair password"), t("Good password"), t("Strong password")][strength];
  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (passwordBusy) return;
    setPasswordBusy(true); setPasswordNote(null);
    const result = await post("/api/auth/password", { password: next, current_password: current });
    setPasswordBusy(false);
    if (!result.ok) { setPasswordNote({ tone: "error", text: result.error ?? "Could not change the password" }); return; }
    setCurrent(""); setNext(""); setPasswordNote({ tone: "ok", text: "Password changed. Other devices were signed out." });
    void refresh();
  }

  // Security: active sessions
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [sessionsAvailable, setSessionsAvailable] = useState(true);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [activity, setActivity] = useState<ActivityRow[] | null>(null);
  useEffect(() => {
    fetch("/api/profile/activity", { credentials: "same-origin" })
      .then(response => response.ok ? response.json() : null)
      .then((data: { events?: ActivityRow[]; available?: boolean } | null) => setActivity(data?.available === false ? [] : data?.events ?? []))
      .catch(() => setActivity([]));
  }, []);
  useEffect(() => {
    fetch("/api/profile/sessions", { credentials: "same-origin" })
      .then(response => response.ok ? response.json() : null)
      .then((data: { sessions?: SessionRow[]; available?: boolean } | null) => { setSessions(data?.sessions ?? []); setSessionsAvailable(data?.available !== false); })
      .catch(() => setSessions([]));
  }, []);
  async function signOutEverywhere() {
    if (signOutBusy) return;
    setSignOutBusy(true);
    const result = await post("/api/profile/sessions", { scope: "global" });
    if (result.ok) window.location.assign("/login");
    else setSignOutBusy(false);
  }

  // Danger zone
  const [confirmDelete, setConfirmDelete] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  async function deleteAccount(event: FormEvent) {
    event.preventDefault();
    if (deleteBusy) return;
    setDeleteBusy(true); setDeleteError("");
    const result = await post("/api/profile", { confirm: confirmDelete }, "DELETE");
    if (result.ok) { window.location.assign("/login"); return; }
    setDeleteBusy(false); setDeleteError(result.error ?? "Could not delete the account");
  }

  const light = mounted && resolvedTheme === "light";
  return <main className="mx-auto w-full max-w-2xl space-y-4 px-3 py-5 sm:px-6 sm:py-8">
    <div className="mb-1 flex items-center justify-between gap-3">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden="true" />{t("Back to workspace")}</Link>
      <Link href="/profile" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><UserRound className="h-4 w-4" aria-hidden="true" />{t("Profile")}</Link>
    </div>
    <h1 className="text-xl font-semibold">{t("Settings")}</h1>

    <Section icon={<Palette className="h-4 w-4" aria-hidden="true" />} title={t("Appearance")}>
      <div className={row}>
        <div><div className={labelCls}>{t("Theme")}</div><p className={hintCls}>{t("Applies to this device.")}</p></div>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-[rgb(var(--ink)/0.06)] p-1">
          {([["dark", t("Dark theme"), <Moon key="d" className="h-3.5 w-3.5" aria-hidden="true" />], ["light", t("Light theme"), <Sun key="l" className="h-3.5 w-3.5" aria-hidden="true" />]] as const).map(([value, label, icon]) =>
            <button key={value} type="button" disabled={!mounted} aria-pressed={mounted && (value === "light") === light} onClick={() => setTheme(value)}
              className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-sm transition-colors ${mounted && (value === "light") === light ? "bg-panel text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {icon}{label}
            </button>)}
        </div>
      </div>
      <div className={`${row} mt-4`}>
        <div><label htmlFor="settings-start" className={labelCls}>{t("Start page")}</label><p className={hintCls}>{t("What opens when you come to the site.")}</p></div>
        <Select id="settings-start" value={preferences.startTab} onChange={event => update({ startTab: event.target.value as typeof preferences.startTab })} className="sm:w-56">
          {START_TAB_OPTIONS.filter(tab => profile?.plan === "owner" || !tab.ownerOnly).map(tab => <option key={tab.id} value={tab.id}>{t(tab.label)}</option>)}
        </Select>
      </div>
    </Section>

    <Section icon={<Languages className="h-4 w-4" aria-hidden="true" />} title={t("Language & time")}>
      <div className="space-y-4">
        <div className={row}>
          <div><label htmlFor="settings-locale" className={labelCls}>{t("Interface language")}</label></div>
          <Select id="settings-locale" value={locale} onChange={event => { if (isLocale(event.target.value)) setLocale(event.target.value); }} className="sm:w-56">
            {LOCALES.map(value => <option key={value} value={value}>{LOCALE_LABEL[value]}</option>)}
          </Select>
        </div>
        <div className={row}>
          <div className="sm:max-w-[55%]"><label htmlFor="settings-zone" className={labelCls}>{t("Your time zone")}</label>
            <p className={hintCls}>{t("Trade times, calendar days, daily and monthly P&L and Strategy Control periods use this zone. Sessions (Asia, London, New York) follow the markets' own clocks and do not change with it.")}</p></div>
          <TimezoneSelect id="settings-zone" aria-label={t("Time zone")} value={timezone} disabled={zoneSaving} onChange={zone => { void setTimezone(zone); }} className="sm:w-56" />
        </div>
      </div>
    </Section>

    <Section icon={<EyeOff className="h-4 w-4" aria-hidden="true" />} title={t("Privacy")}>
      <div className="space-y-4">
        <Toggle label={t("Hide amounts")} hint={t("Money values show as ••• — for screenshots and streams. R and percentages stay visible.")} on={preferences.privacy} onChange={value => update({ privacy: value })} />
        <Toggle label={t("Remind me to review trades")} hint={t("A note on Home when closed trades are waiting for setup and emotion.")} on={preferences.reviewReminder} onChange={value => update({ reviewReminder: value })} />
      </div>
    </Section>

    <Section icon={<SlidersHorizontal className="h-4 w-4" aria-hidden="true" />} title={t("Formats and defaults")}>
      <div className="space-y-4">
        <div className={row}>
          <div><label htmlFor="settings-number" className={labelCls}>{t("Number format")}</label><p className={hintCls}>{t("Example: {value}", { value: formatNumber(12345.67, 2, preferences.numberFormat) })}</p></div>
          <Select id="settings-number" value={preferences.numberFormat} onChange={event => update({ numberFormat: event.target.value as typeof preferences.numberFormat })} className="sm:w-56">
            <option value="plain">12345.67</option>
            <option value="grouped">12,345.67</option>
            <option value="european">12 345,67</option>
          </Select>
        </div>
        <div className={row}>
          <div><label htmlFor="settings-week" className={labelCls}>{t("Week starts on")}</label><p className={hintCls}>{t("Calendar grids. Weekly reports keep Monday to Sunday.")}</p></div>
          <Select id="settings-week" value={String(preferences.weekStart)} onChange={event => update({ weekStart: event.target.value === "0" ? 0 : 1 })} className="sm:w-56">
            <option value="1">{t("Monday")}</option>
            <option value="0">{t("Sunday")}</option>
          </Select>
        </div>
        <div className={row}>
          <div><label htmlFor="settings-account" className={labelCls}>{t("Default account")}</label><p className={hintCls}>{t("Selected when you open the site.")}</p></div>
          <Select id="settings-account" value={preferences.defaultAccountId ?? ""} onChange={event => update({ defaultAccountId: event.target.value || null })} className="sm:w-56">
            <option value="">{t("Last used")}</option>
            {accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
          </Select>
        </div>
        <div className={row}>
          <div><label htmlFor="settings-risk" className={labelCls}>{t("Default risk per trade, %")}</label><p className={hintCls}>{t("Prefilled when you add a trade by hand.")}</p></div>
          <Input id="settings-risk" inputMode="decimal" className="sm:w-56" placeholder="1" defaultValue={preferences.defaultRiskPercent ?? ""} key={preferences.defaultRiskPercent ?? "none"}
            onBlur={event => { const value = event.target.value.trim().replace(",", "."); update({ defaultRiskPercent: value === "" ? null : Number(value) }); }} />
        </div>
        {preferences.onboardingDismissed && <div className={row}>
          <div><div className={labelCls}>{t("Getting started")}</div><p className={hintCls}>{t("The first-steps card on Home is hidden.")}</p></div>
          <Button type="button" variant="secondary" onClick={() => update({ onboardingDismissed: false })}>{t("Show again")}</Button>
        </div>}
      </div>
    </Section>

    <Section icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />} title={t("Security")}>
      <div className="space-y-5">
        <form onSubmit={changePassword} className="space-y-3">
          <div className={labelCls}>{t("Change password")}</div>
          {!hasPassword && <p className={hintCls}>{t("You sign in with Google. To add a password, use “Forgot your password?” on the sign-in page with this e-mail.")}</p>}
          <input type="email" autoComplete="username" value={profile?.email ?? ""} readOnly hidden />
          <Input type="password" autoComplete="current-password" value={current} onChange={event => setCurrent(event.target.value)} placeholder={t("Current password")} aria-label={t("Current password")} className="max-w-sm" disabled={!hasPassword} />
          <Input type="password" autoComplete="new-password" minLength={PASSWORD_MIN} value={next} onChange={event => setNext(event.target.value)} placeholder={t("New password")} aria-label={t("New password")} className="max-w-sm" />
          {next && <div className="max-w-sm"><PasswordStrength score={strength} label={strengthLabel} /></div>}
          {passwordNote && <p role={passwordNote.tone === "error" ? "alert" : "status"} className={`text-sm ${passwordNote.tone === "error" ? "text-destructive" : "text-green"}`}>{t(passwordNote.text)}</p>}
          <Button type="submit" variant="secondary" loading={passwordBusy} disabled={!hasPassword || next.length < PASSWORD_MIN || !current}><KeyRound className="h-4 w-4" aria-hidden="true" />{t("Change password")}</Button>
        </form>

        <div className={row}>
          <div><div className={labelCls}>Google</div><p className={hintCls}>{googleLinked ? t("Linked: you can sign in with Google.") : t("Not linked. Use “Continue with Google” on the sign-in page with this email to link it.")}</p></div>
          <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium ${googleLinked ? "bg-green/15 text-green" : "bg-[rgb(var(--ink)/0.08)] text-muted-foreground"}`}>{googleLinked ? t("Linked") : t("Not linked")}</span>
        </div>

        <div>
          <div className={labelCls}>{t("Active sessions")}</div>
          {sessions === null ? <p className={hintCls}>{t("Loading…")}</p>
            : !sessionsAvailable ? <p className={hintCls}>{t("The session list appears after the next database update. Signing out everywhere already works.")}</p>
            : sessions.length === 0 ? <p className={hintCls}>{t("Could not load sessions")}</p>
            : <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
              {sessions.map(session => <li key={session.id} className="flex items-center gap-3 px-3.5 py-2.5">
                <MonitorSmartphone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{session.user_agent || t("Unknown device")}</div>
                  <div className="truncate text-xs text-muted-foreground">{t("Active {time}", { time: formatDateTimeOrDash(session.updated_at ?? session.created_at, timezone) })}{session.ip ? ` · ${session.ip}` : ""}</div>
                </div>
              </li>)}
            </ul>}
          <Button type="button" variant="secondary" className="mt-3" loading={signOutBusy} onClick={() => void signOutEverywhere()}><LogOut className="h-4 w-4" aria-hidden="true" />{t("Sign out everywhere")}</Button>
        </div>

        <div>
          <div className={labelCls}>{t("Recent activity")}</div>
          <p className={hintCls}>{t("Sign-ins and security changes on your account. Something you do not recognise? Change the password and sign out everywhere.")}</p>
          {activity === null ? <p className={hintCls}>{t("Loading…")}</p>
            : activity.length === 0 ? <p className={hintCls}>{t("No events yet.")}</p>
            : <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
              {activity.map(event => <li key={event.id} className="flex items-start gap-3 px-3.5 py-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{t(ACTIVITY_LABEL[event.action] ?? event.action)}{event.method && METHOD_LABEL[event.method] ? <span className="text-muted-foreground"> · {t(METHOD_LABEL[event.method])}</span> : null}</div>
                  <div className="truncate text-xs text-muted-foreground">{formatDateTimeOrDash(event.created_at, timezone)}{event.user_agent ? ` · ${event.user_agent}` : ""}</div>
                </div>
              </li>)}
            </ul>}
        </div>
      </div>
    </Section>

    <Section icon={<MonitorSmartphone className="h-4 w-4" aria-hidden="true" />} title={t("MT5 Bridge")}>
      <div className={row}>
        <p className="text-sm text-muted-foreground sm:max-w-[60%]">{t("Connected computers sync MT5 trades into the journal automatically.")}</p>
        <Link href="/bridge/connect" className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-4 text-sm font-medium text-secondary-foreground transition-colors hover:bg-accent">{t("Manage computers")}</Link>
      </div>
    </Section>

    <Section icon={<Download className="h-4 w-4" aria-hidden="true" />} title={t("Your data")}>
      <p className="text-sm text-muted-foreground">{t("Download a copy of everything you keep here. JSON holds accounts, trades, strategies and layouts; CSV holds trades and opens in Excel or Google Sheets.")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href="/api/profile/export?format=csv" download className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-secondary px-4 text-sm font-medium text-secondary-foreground transition-colors hover:bg-accent"><Download className="h-4 w-4" aria-hidden="true" />{t("Trades (CSV)")}</a>
        <a href="/api/profile/export?format=json" download className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-secondary px-4 text-sm font-medium text-secondary-foreground transition-colors hover:bg-accent"><Download className="h-4 w-4" aria-hidden="true" />{t("Everything (JSON)")}</a>
      </div>
    </Section>

    <Section icon={<Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />} title={t("Delete account")}>
      {profile?.plan === "owner" ? <p className="text-sm text-muted-foreground">{t("The installation owner cannot be deleted from the app.")}</p> : <form onSubmit={deleteAccount} className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("Deletes your profile and every account, trade, strategy, layout and connected computer. This cannot be undone. Type your email to confirm.")}</p>
        <Input type="email" inputMode="email" autoComplete="off" value={confirmDelete} onChange={event => setConfirmDelete(event.target.value)} placeholder={profile?.email ?? t("Email")} aria-label={t("Type your email to confirm deletion")} className="max-w-sm" />
        {deleteError && <p role="alert" className="text-sm text-destructive">{t(deleteError)}</p>}
        <Button type="submit" variant="destructive" loading={deleteBusy} disabled={!confirmDelete || confirmDelete.trim().toLowerCase() !== (profile?.email ?? "").toLowerCase()}>{t("Delete my account")}</Button>
      </form>}
    </Section>
  </main>;
}
