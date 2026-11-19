"use client";
import { Hint } from "@/components/ui/hint";
import { useState } from "react";
import { Check, ChevronDown, Layers3, Plus, Trash2, Wallet2 } from "lucide-react";
import { NewAccountModal } from "@/components/accounts/new-account-modal";
import { Button, Panel } from "@/components/ui/primitives";
import { Switch } from "@/components/ui/switch";
import { useTrades } from "@/hooks/use-trades";
import { kindLabel } from "@/lib/accounts/account-data";
import { fmt } from "@/lib/journal/utils-trade";
import { useI18n } from "@/components/providers/i18n-provider";

function currencyAmount(value: number, currency: "USD" | "USDT") { return `${fmt.money(value)} ${currency}`; }
function badgeBackground(color: string) { return `color-mix(in oklab, ${color} 13%, transparent)`; }
export default function AccountSwitcher() {
  const { accounts, activeAccountId, activeAccount, setActiveAccountId, includedAccountIds, toggleAccountIncluded, deleteAccount, upsertAccount } = useTrades();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(false);
  const label = activeAccountId === "all" ? { title: t("All accounts"), sub: t("{count} included", { count: includedAccountIds.length }), color: "var(--color-primary)", icon: <Layers3 className="h-4 w-4 text-foreground" /> } : activeAccount ? { title: activeAccount.name, sub: currencyAmount(activeAccount.initialBalance, activeAccount.currency), color: activeAccount.color, icon: <Wallet2 className="h-4 w-4 text-foreground" /> } : { title: t("Select account"), sub: t("No account selected"), color: "var(--color-primary)", icon: <Wallet2 className="h-4 w-4 text-foreground" /> };
  return <>
    <div className="relative min-w-0 flex-1 sm:flex-none">
      <Button variant="secondary" aria-expanded={open} aria-label={t("Account manager: {name}", { name: label.title })} onClick={() => setOpen(x => !x)} className="w-full min-w-0 sm:min-w-[220px]" style={{ justifyContent: "space-between", textAlign: "left", padding: "0.5rem 0.625rem" }}>
        <div className="flex min-w-0 items-center gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl sm:h-9 sm:w-9" style={{ backgroundColor: badgeBackground(label.color) }}>{label.icon}</div><div className="min-w-0"><div className="truncate text-sm font-medium">{label.title}</div><div className="truncate text-xs text-muted-foreground">{label.sub}</div></div></div><ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Button>
      {open ? <><button type="button" aria-label={t("Close account manager")} onClick={() => setOpen(false)} className="fixed inset-0 z-30 cursor-default" /><Panel className="fixed inset-x-3 top-16 z-40 max-h-[calc(100dvh-9rem)] overflow-y-auto p-4 shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-3 sm:w-[380px] sm:max-h-[75vh]">
        <div className="mb-4"><p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{t("Trading account manager")}</p><p className="mt-2 text-sm text-muted-foreground">{t("Choose the active account and which accounts count towards dashboard totals. Trades are managed in the journal.")}</p></div>
        <div className="space-y-2">
          <Button variant={activeAccountId === "all" ? "secondary" : "ghost"} onClick={() => { setActiveAccountId("all"); setOpen(false); }} className="w-full" style={{ textAlign: "left", justifyContent: "flex-start", padding: "0.75rem" }}>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10"><Layers3 className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="text-sm font-medium">{t("All accounts")}</div><div className="text-xs text-muted-foreground">{t("Combined · {count} included", { count: includedAccountIds.length })}</div></div>{activeAccountId === "all" ? <Check className="h-4 w-4 text-primary" /> : null}
          </Button>
          {accounts.map(account => {
            const included = includedAccountIds.includes(account.id);
            return <div key={account.id} className="flex items-center gap-2 rounded-2xl p-2 hover:bg-secondary/30">
              <Button variant="ghost" onClick={() => { setActiveAccountId(account.id); setOpen(false); }} className="min-w-0 flex-1" style={{ textAlign: "left", justifyContent: "flex-start", padding: 0 }}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: badgeBackground(account.color) }}><Wallet2 className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{account.name}</div><div className="truncate text-xs text-muted-foreground">{t(kindLabel[account.kind])} · {currencyAmount(account.initialBalance, account.currency)}</div></div>{activeAccountId === account.id ? <Check className="h-4 w-4 text-primary" /> : null}
              </Button>
              <span className="flex h-10 shrink-0 items-center px-1" title={t("Include {name} in totals", { name: account.name })}><Switch size="sm" aria-label={t("Include {name} in totals", { name: account.name })} isSelected={included} onChange={() => toggleAccountIncluded(account.id)} /></span>
              <Hint label={t("Delete account {name}", { name: account.name })}><Button variant="ghost" size="icon" aria-label={t("Delete account {name}", { name: account.name })} onClick={() => void deleteAccount(account.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></Hint>
            </div>;
          })}
        </div>
        <div className="mt-4 grid gap-2"><Button variant="secondary" onClick={() => { setOpen(false); setModal(true); }} className="w-full" style={{ justifyContent: "space-between", textAlign: "left", padding: "0.75rem 1rem" }}><div><div className="text-sm font-medium">{t("New account")}</div><div className="mt-1 text-xs text-muted-foreground">{t("Personal or prop · manual journal · optional MT5 profile")}</div></div><Plus className="h-4 w-4 shrink-0" /></Button></div>
      </Panel></> : null}
    </div>
    {modal ? <NewAccountModal onClose={() => setModal(false)} onCreate={async account => { const saved = await upsertAccount(account); setActiveAccountId(saved.id); }} /> : null}
  </>;
}
