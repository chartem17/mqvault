"use client";

import { Hint } from "@/components/ui/hint";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { useTrades } from "@/hooks/use-trades";
import { useStrategies } from "@/hooks/use-strategies";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useI18n } from "@/components/providers/i18n-provider";
import { NewAccountModal } from "@/components/accounts/new-account-modal";
import { CsvImportModal } from "@/components/journal/csv-import-modal";
import { Button, Panel } from "@/components/ui/primitives";
import { needsReview } from "@/lib/journal/trade-review";

/**
 * First steps for a new workspace: account → trades (CSV, MT5 Bridge or by hand) → strategy → first review.
 * Disappears when every step is done or the user hides it (Settings can bring it back).
 */
export function Onboarding() {
  const { t } = useI18n();
  const router = useRouter();
  const { accounts, trades, upsertAccount, setActiveAccountId, refreshTrades, activeAccountId } = useTrades();
  const { strategies } = useStrategies();
  const { preferences, ready, update } = usePreferences();
  const [newAccount, setNewAccount] = useState(false);
  const [importing, setImporting] = useState(false);

  const steps = [
    { key: "account", done: accounts.length > 0, title: t("Add a trading account"), hint: t("Personal or prop, any broker. Balance and prop rules can be changed later."),
      action: <Button size="sm" onClick={() => setNewAccount(true)}>{t("Add account")}</Button> },
    { key: "trades", done: trades.length > 0, title: t("Bring in your trades"), hint: t("Import a CSV export from your broker, connect MT5 Bridge for automatic sync, or add a trade by hand in the journal."),
      action: <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" disabled={!accounts.length} onClick={() => setImporting(true)}>{t("Import CSV")}</Button>
        <Link href="/bridge/connect" className="inline-flex min-h-8 items-center rounded-xl border border-border bg-secondary px-3 text-xs font-medium text-secondary-foreground hover:bg-accent">{t("Connect MT5")}</Link>
        <Button size="sm" variant="ghost" onClick={() => router.push("/?tab=journal", { scroll: false })}>{t("Open journal")}</Button>
      </div> },
    { key: "strategy", done: strategies.length > 0, title: t("Write down your rules"), hint: t("A strategy turns your rules into checks: trades per day, sessions, risk, news. Home and Strategy Control use it."),
      action: <Button size="sm" variant="secondary" onClick={() => router.push("/?tab=strategy-control", { scroll: false })}>{t("Create strategy")}</Button> },
    { key: "review", done: trades.some(trade => trade.closed_at && !needsReview(trade)), title: t("Review your first trade"), hint: t("Setup, emotion and whether it followed the plan — a few taps per trade. This is what makes the statistics honest."),
      action: <Button size="sm" variant="secondary" disabled={!trades.length} onClick={() => router.push("/?tab=journal&review=1", { scroll: false })}>{t("Start review")}</Button> },
  ];
  const doneCount = steps.filter(step => step.done).length;
  if (!ready || preferences.onboardingDismissed || doneCount === steps.length) return null;
  const next = steps.find(step => !step.done)?.key;

  return <Panel className="p-5 sm:p-6" aria-label={t("Getting started")}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="m-0 text-base font-semibold">{t("Getting started")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("{done} of {total} steps done", { done: doneCount, total: steps.length })}</p>
      </div>
      <Hint label={t("Hide getting started")}><button type="button" onClick={() => update({ onboardingDismissed: true })} aria-label={t("Hide getting started")} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"><X className="h-4 w-4" aria-hidden="true" /></button></Hint>
    </div>
    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[rgb(var(--ink)/0.1)]"><div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${doneCount / steps.length * 100}%` }} /></div>
    <ol className="mt-4 space-y-3 p-0">
      {steps.map((step, index) => <li key={step.key} className={`flex list-none gap-3 rounded-xl border p-3.5 ${step.key === next ? "border-ring/50 bg-primary/5" : "border-border"}`}>
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${step.done ? "bg-green/20 text-green" : "bg-[rgb(var(--ink)/0.08)] text-muted-foreground"}`}>{step.done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}</span>
        <div className="min-w-0 flex-1">
          <div className={`text-sm font-medium ${step.done ? "text-muted-foreground line-through" : ""}`}>{step.title}</div>
          {!step.done && <><p className="mt-0.5 text-xs text-muted-foreground">{step.hint}</p>{step.key === next && <div className="mt-2.5">{step.action}</div>}</>}
        </div>
      </li>)}
    </ol>
    {newAccount && <NewAccountModal onClose={() => setNewAccount(false)} onCreate={async account => { const saved = await upsertAccount(account); setActiveAccountId(saved.id); }} />}
    <CsvImportModal open={importing} accounts={accounts} defaultAccountId={activeAccountId !== "all" ? activeAccountId : undefined} onClose={() => setImporting(false)} onImported={() => void refreshTrades()} />
  </Panel>;
}
