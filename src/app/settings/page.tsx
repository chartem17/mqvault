"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowLeft, KeyRound, Languages, LogOut, MonitorSmartphone, Moon, Palette, ShieldCheck, Sun, Trash2, UserRound } from "lucide-react";
import { Button, Input, Panel, Select } from "@/components/ui/primitives";
import { PasswordStrength } from "@/components/ui/otp-input";
import { TimezoneSelect } from "@/components/settings/timezone-select";
import { useTimezone } from "@/components/providers/timezone-provider";
import { useI18n } from "@/components/providers/i18n-provider";
import { useProfile } from "@/components/providers/profile-provider";
import { LOCALE_LABEL, LOCALES, isLocale } from "@/lib/i18n/core";
import { PASSWORD_MIN, passwordStrength } from "@/lib/auth/request-guard";
import { formatDateTimeOrDash } from "@/lib/time/timezone";

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
    const result = await post("/api/auth/password", hasPassword ? { password: next, current } : { password: next });
    setPasswordBusy(false);
    if (!result.ok) { setPasswordNote({ tone: "error", text: result.error ?? "Could not change the password" }); return; }
    setCurrent(""); setNext(""); setPasswordNote({ tone: "ok", text: hasPassword ? "Password changed." : "Password set. You can now sign in with email and password." });
    void refresh();
  }

  // Security: active sessions
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [signOutBusy, setSignOutBusy] = useState(false);
  useEffect(() => {
    fetch("/api/profile/sessions", { credentials: "same-origin" })
      .then(response => response.ok ? response.json() : null)
      .then((data: { sessions?: SessionRow[] } | null) => setSessions(data?.sessions ?? []))
      .catch(() => setSessions([]));
  }, []);
  async function signOutEverywhere() {
    if (signOutBusy) return;
    setSignOutBusy(true);
    const result = await post("/api/auth/logout", { scope: "global" });
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

    <Section icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />} title={t("Security")}>
      <div className="space-y-5">
        <form onSubmit={changePassword} className="space-y-3">
          <div className={labelCls}>{hasPassword ? t("Change password") : t("Set a password")}</div>
          {!hasPassword && <p className={hintCls}>{t("You sign in with Google. A password also enables email sign-in and scripts.")}</p>}
          <input type="email" autoComplete="username" value={profile?.email ?? ""} readOnly hidden />
          {hasPassword && <Input type="password" autoComplete="current-password" value={current} onChange={event => setCurrent(event.target.value)} placeholder={t("Current password")} aria-label={t("Current password")} className="max-w-sm" />}
          <Input type="password" autoComplete="new-password" minLength={PASSWORD_MIN} value={next} onChange={event => setNext(event.target.value)} placeholder={t("New password")} aria-label={t("New password")} className="max-w-sm" />
          {next && <div className="max-w-sm"><PasswordStrength score={strength} label={strengthLabel} /></div>}
          {passwordNote && <p role={passwordNote.tone === "error" ? "alert" : "status"} className={`text-sm ${passwordNote.tone === "error" ? "text-destructive" : "text-green"}`}>{t(passwordNote.text)}</p>}
          <Button type="submit" variant="secondary" loading={passwordBusy} disabled={next.length < PASSWORD_MIN || (hasPassword && !current)}><KeyRound className="h-4 w-4" aria-hidden="true" />{hasPassword ? t("Change password") : t("Set a password")}</Button>
        </form>

        <div className={row}>
          <div><div className={labelCls}>Google</div><p className={hintCls}>{googleLinked ? t("Linked: you can sign in with Google.") : t("Not linked. Use “Continue with Google” on the sign-in page with this email to link it.")}</p></div>
          <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium ${googleLinked ? "bg-green/15 text-green" : "bg-[rgb(var(--ink)/0.08)] text-muted-foreground"}`}>{googleLinked ? t("Linked") : t("Not linked")}</span>
        </div>

        <div>
          <div className={labelCls}>{t("Active sessions")}</div>
          {sessions === null ? <p className={hintCls}>{t("Loading…")}</p>
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
      </div>
    </Section>

    <Section icon={<MonitorSmartphone className="h-4 w-4" aria-hidden="true" />} title={t("MT5 Bridge")}>
      <div className={row}>
        <p className="text-sm text-muted-foreground sm:max-w-[60%]">{t("Connected computers sync MT5 trades into the journal automatically.")}</p>
        <Link href="/bridge/connect" className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-4 text-sm font-medium text-secondary-foreground transition-colors hover:bg-accent">{t("Manage computers")}</Link>
      </div>
    </Section>

    <Section icon={<Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />} title={t("Delete account")}>
      <form onSubmit={deleteAccount} className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("Deletes your profile and every account, trade, strategy, layout and connected computer. This cannot be undone. Type your email to confirm.")}</p>
        <Input type="email" inputMode="email" autoComplete="off" value={confirmDelete} onChange={event => setConfirmDelete(event.target.value)} placeholder={profile?.email ?? t("Email")} aria-label={t("Type your email to confirm deletion")} className="max-w-sm" />
        {deleteError && <p role="alert" className="text-sm text-destructive">{t(deleteError)}</p>}
        <Button type="submit" variant="destructive" loading={deleteBusy} disabled={!confirmDelete || confirmDelete.trim().toLowerCase() !== (profile?.email ?? "").toLowerCase()}>{t("Delete my account")}</Button>
      </form>
    </Section>
  </main>;
}
