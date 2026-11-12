"use client";

import { Hint } from "@/components/ui/hint";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Check, LogOut, Pencil, Settings, Wallet2, X } from "lucide-react";
import { Button, Input, Panel } from "@/components/ui/primitives";
import { useI18n } from "@/components/providers/i18n-provider";
import { useProfile, avatarInitial } from "@/components/providers/profile-provider";
import { useTrades } from "@/hooks/use-trades";
import { traderSummary } from "@/lib/journal/trader-summary";
import { useTimezone } from "@/components/providers/timezone-provider";
import { useMemo } from "react";
import { fmt } from "@/lib/journal/utils-trade";

/** Profile: who is signed in, counters and the account list. Editing is limited to the display name (ADR 0017). */
export default function ProfilePage() {
  const { t } = useI18n();
  const { profile, counters, loading, saveName } = useProfile();
  const { trades } = useTrades();
  const { timezone } = useTimezone();
  const { intl } = useI18n();
  const summary = useMemo(() => traderSummary(trades, timezone), [trades, timezone]);
  const day = (key: string) => new Date(`${key}T12:00:00Z`).toLocaleDateString(intl, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [leaving, setLeaving] = useState(false);
  async function signOut() {
    if (leaving) return;
    setLeaving(true);
    try { await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", credentials: "same-origin" }); } catch { /* the reload shows the real state */ }
    window.location.assign("/login");
  }
  useEffect(() => { setDraft(profile?.display_name ?? ""); }, [profile?.display_name]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    const problem = await saveName(draft);
    setBusy(false);
    if (problem) setError(problem); else setEditing(false);
  }

  return <main className="page-enter mx-auto w-full max-w-2xl px-3 py-5 sm:px-6 sm:py-8">
    <div className="mb-5 flex items-center justify-between gap-3">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden="true" />{t("Back to workspace")}</Link>
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><Settings className="h-4 w-4" aria-hidden="true" />{t("Settings")}</Link>
    </div>

    <Panel className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-4">
        <span className="relative inline-flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-primary">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {profile?.avatar_url ? <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : <span className="text-xl font-semibold">{avatarInitial(profile)}</span>}
        </span>
        <div className="min-w-0 flex-1">
          {editing ? <form onSubmit={submit} className="flex items-center gap-2">
            <Input value={draft} onChange={event => setDraft(event.target.value)} maxLength={80} autoFocus aria-label={t("Display name")} placeholder={t("Your name")} className="max-w-xs" />
            <Button type="submit" size="icon" loading={busy} aria-label={t("Save name")}><Check className="h-4 w-4" aria-hidden="true" /></Button>
            <Button type="button" size="icon" variant="ghost" aria-label={t("Cancel")} onClick={() => { setEditing(false); setDraft(profile?.display_name ?? ""); setError(""); }}><X className="h-4 w-4" aria-hidden="true" /></Button>
          </form> : <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-xl font-semibold">{profile?.display_name || (loading ? "…" : t("Unnamed trader"))}</h1>
            <Hint label={t("Edit name")}><button type="button" aria-label={t("Edit name")} onClick={() => setEditing(true)} className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"><Pencil className="h-3.5 w-3.5" aria-hidden="true" /></button></Hint>
          </div>}
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{profile?.email ?? ""}</p>
          <span className="mt-2 inline-flex items-center rounded-full bg-primary/12 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary">{profile?.plan === "owner" ? t("Owner") : t("Closed beta")}</span>
        </div>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{t(error)}</p>}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-background/40 p-3.5"><div className="flex items-center gap-2 text-muted-foreground"><Wallet2 className="h-4 w-4" aria-hidden="true" /><span className="text-xs">{t("Accounts")}</span></div><div className="mt-1 text-2xl font-semibold tabular-nums">{counters.accounts}</div></div>
        <div className="rounded-xl border border-border bg-background/40 p-3.5"><div className="flex items-center gap-2 text-muted-foreground"><BookOpen className="h-4 w-4" aria-hidden="true" /><span className="text-xs">{t("Trades")}</span></div><div className="mt-1 text-2xl font-semibold tabular-nums">{counters.trades}</div></div>
      </div>
    </Panel>

    <Panel className="mt-4 p-5 sm:p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("Trader card")}</h2>
      {summary.closed === 0 ? <p className="mt-3 text-sm text-muted-foreground">{t("Close your first trade and your lifetime numbers will appear here.")}</p>
        : <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            [t("Journaling since"), summary.firstDay ? day(summary.firstDay) : "—"],
            [t("Trading days"), String(summary.tradingDays)],
            [t("Win rate"), summary.winRate === null ? "—" : `${summary.winRate}%`],
            [t("Average R"), summary.averageR === null ? "—" : `${summary.averageR > 0 ? "+" : ""}${summary.averageR}R`],
            [t("Most traded"), summary.topSymbol ? `${summary.topSymbol.symbol} · ${summary.topSymbol.count}` : "—"],
            [t("Reviewed trades"), summary.reviewedShare === null ? "—" : `${summary.reviewedShare}%`],
            [t("Best day"), summary.bestDay ? `${day(summary.bestDay.day)} · +${fmt.money(summary.bestDay.net)}` : "—"],
            [t("Worst day"), summary.worstDay ? `${day(summary.worstDay.day)} · ${fmt.money(summary.worstDay.net)}` : "—"],
          ].map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-background/40 p-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 truncate text-sm font-semibold tabular-nums">{value}</dd>
          </div>)}
        </dl>}
      <p className="mt-3 text-xs text-muted-foreground">{t("All accounts, closed trades. Days follow your time zone.")}</p>
    </Panel>

    <div className="mt-4 flex justify-end">
      <Button variant="secondary" loading={leaving} onClick={() => void signOut()}><LogOut className="h-4 w-4" aria-hidden="true" />{leaving ? t("Signing out…") : t("Sign out")}</Button>
    </div>
  </main>;
}
