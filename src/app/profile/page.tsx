"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Check, Pencil, Settings, Wallet2, X } from "lucide-react";
import { Button, Input, Panel } from "@/components/ui/primitives";
import { useI18n } from "@/components/providers/i18n-provider";
import { useProfile, avatarInitial } from "@/components/providers/profile-provider";
import { useTrades } from "@/hooks/use-trades";
import { accountOverviewLabel } from "@/lib/accounts/account-overview";
import { fmt } from "@/lib/journal/utils-trade";

/** Profile: who is signed in, counters and the account list. Editing is limited to the display name (ADR 0017). */
export default function ProfilePage() {
  const { t } = useI18n();
  const { profile, counters, loading, saveName } = useProfile();
  const { accounts } = useTrades();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setDraft(profile?.display_name ?? ""); }, [profile?.display_name]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    const problem = await saveName(draft);
    setBusy(false);
    if (problem) setError(problem); else setEditing(false);
  }

  return <main className="mx-auto w-full max-w-2xl px-3 py-5 sm:px-6 sm:py-8">
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
            <button type="button" aria-label={t("Edit name")} title={t("Edit name")} onClick={() => setEditing(true)} className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"><Pencil className="h-3.5 w-3.5" aria-hidden="true" /></button>
          </div>}
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{profile?.email ?? ""}</p>
          <span className="mt-2 inline-flex items-center rounded-full bg-primary/12 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary">{profile?.plan === "pro" ? t("Pro plan") : t("Free plan")}</span>
        </div>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{t(error)}</p>}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-background/40 p-3.5"><div className="flex items-center gap-2 text-muted-foreground"><Wallet2 className="h-4 w-4" aria-hidden="true" /><span className="text-xs">{t("Accounts")}</span></div><div className="mt-1 text-2xl font-semibold tabular-nums">{counters.accounts}</div></div>
        <div className="rounded-xl border border-border bg-background/40 p-3.5"><div className="flex items-center gap-2 text-muted-foreground"><BookOpen className="h-4 w-4" aria-hidden="true" /><span className="text-xs">{t("Trades")}</span></div><div className="mt-1 text-2xl font-semibold tabular-nums">{counters.trades}</div></div>
      </div>
    </Panel>

    <Panel className="mt-4 p-5 sm:p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("Your accounts")}</h2>
      {accounts.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{t("No accounts yet. Create one from the account manager in the header.")}</p>
        : <ul className="mt-3 divide-y divide-border">
          {accounts.map(account => <li key={account.id} className="flex items-center gap-3 py-2.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: account.color }} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{account.name}</div>
              <div className="truncate text-xs text-muted-foreground">{accountOverviewLabel(account, t)}</div>
            </div>
            <div className="shrink-0 text-sm tabular-nums text-muted-foreground">{fmt.num(account.initialBalance)} {account.currency}</div>
          </li>)}
        </ul>}
    </Panel>
  </main>;
}
