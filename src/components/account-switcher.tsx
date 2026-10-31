"use client";
import { useState } from "react";
import { Check, ChevronDown, Layers3, Plus, Trash2, Wallet2 } from "lucide-react";
import { NewAccountModal } from "@/components/accounts/new-account-modal";
import { Button, Panel } from "@/components/ui/primitives";
import { Checkbox } from "@/components/ui/checkbox";
import { useTrades } from "@/hooks/use-trades";
import { kindLabel } from "@/lib/account-data";
import { fmt } from "@/lib/utils-trade";

function currencyAmount(value: number, currency: "USD" | "USDT") { return `${fmt.num(value)} ${currency}`; }
function badgeBackground(color: string) { return `color-mix(in oklab, ${color} 13%, transparent)`; }
export default function AccountSwitcher() {
  const { accounts, activeAccountId, activeAccount, setActiveAccountId, includedAccountIds, toggleAccountIncluded, deleteAccount, upsertAccount } = useTrades();
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(false);
  const label = activeAccountId === "all" ? { title: "All accounts", sub: `${includedAccountIds.length} included`, color: "var(--color-primary)", icon: <Layers3 className="h-4 w-4 text-foreground" /> } : activeAccount ? { title: activeAccount.name, sub: currencyAmount(activeAccount.initialBalance, activeAccount.currency), color: activeAccount.color, icon: <Wallet2 className="h-4 w-4 text-foreground" /> } : { title: "Select account", sub: "No account selected", color: "var(--color-primary)", icon: <Wallet2 className="h-4 w-4 text-foreground" /> };
  return <>
    <div className="relative">
      <Button variant="secondary" aria-expanded={open} aria-label={`Account manager: ${label.title}`} onClick={() => setOpen(x => !x)} className="min-w-[220px]" style={{ justifyContent: "space-between", textAlign: "left", padding: "0.625rem 0.75rem" }}>
        <div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: badgeBackground(label.color) }}>{label.icon}</div><div className="min-w-0"><div className="truncate text-sm font-medium">{label.title}</div><div className="truncate text-xs text-muted-foreground">{label.sub}</div></div></div><ChevronDown className="h-4 w-4 text-muted-foreground" />
      </Button>
      {open ? <><button type="button" aria-label="Close account manager" onClick={() => setOpen(false)} className="fixed inset-0 z-30 cursor-default" /><Panel className="absolute right-0 z-40 mt-3 w-[min(380px,calc(100vw-2rem))] p-4 shadow-2xl">
        <div className="mb-4"><p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Trading account manager</p><p className="mt-2 text-sm text-muted-foreground">Choose active profiles and accounts included in dashboard totals. Trades are managed in the journal.</p></div>
        <div className="space-y-2">
          <Button variant={activeAccountId === "all" ? "secondary" : "ghost"} onClick={() => { setActiveAccountId("all"); setOpen(false); }} className="w-full" style={{ textAlign: "left", justifyContent: "flex-start", padding: "0.75rem" }}>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10"><Layers3 className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="text-sm font-medium">All accounts</div><div className="text-xs text-muted-foreground">Combined · {includedAccountIds.length} included</div></div>{activeAccountId === "all" ? <Check className="h-4 w-4 text-primary" /> : null}
          </Button>
          {accounts.map(account => {
            const included = includedAccountIds.includes(account.id);
            return <div key={account.id} className="flex items-center gap-2 rounded-2xl p-2 hover:bg-secondary/30">
              <Button variant="ghost" onClick={() => { setActiveAccountId(account.id); setOpen(false); }} className="min-w-0 flex-1" style={{ textAlign: "left", justifyContent: "flex-start", padding: 0 }}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: badgeBackground(account.color) }}><Wallet2 className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{account.name}</div><div className="truncate text-xs text-muted-foreground">{kindLabel[account.kind]} · {currencyAmount(account.initialBalance, account.currency)}</div></div>{activeAccountId === account.id ? <Check className="h-4 w-4 text-primary" /> : null}
              </Button>
              <label className="flex h-10 w-10 shrink-0 items-center justify-center" title={`Include ${account.name} in totals`}><Checkbox aria-label={`Include ${account.name} in totals`} checked={included} onChange={() => toggleAccountIncluded(account.id)} /></label>
              <Button variant="ghost" size="icon" aria-label={`Delete account ${account.name}`} title={`Delete account ${account.name}`} onClick={() => void deleteAccount(account.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>;
          })}
        </div>
        <div className="mt-4 grid gap-2"><Button variant="secondary" onClick={() => { setOpen(false); setModal(true); }} className="w-full" style={{ justifyContent: "space-between", textAlign: "left", padding: "0.75rem 1rem" }}><div><div className="text-sm font-medium">New account</div><div className="mt-1 text-xs text-muted-foreground">Personal or prop · Manual journal · Optional MT5 platform profile</div></div><Plus className="h-4 w-4 shrink-0" /></Button></div>
      </Panel></> : null}
    </div>
    {modal ? <NewAccountModal onClose={() => setModal(false)} onCreate={async account => { const saved = await upsertAccount(account); setActiveAccountId(saved.id); }} /> : null}
  </>;
}
