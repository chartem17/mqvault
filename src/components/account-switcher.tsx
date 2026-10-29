"use client";
import { useState } from "react";
import { Activity, Check, CheckSquare, ChevronDown, Layers3, Plus, Radio, Square, Trash2, Wallet2 } from "lucide-react";
import { NewAccountModal } from "@/components/accounts/new-account-modal";
import { useTrades } from "@/hooks/use-trades";
import { useMt5 } from "@/hooks/use-mt5";
import { kindLabel } from "@/lib/account-data";
import { fmt } from "@/lib/utils-trade";

function currencyAmount(value: number, currency: "USD" | "USDT") { return `${fmt.num(value)} ${currency}`; }
function Mt5Panel() {
  const { health, positions, loading, refresh } = useMt5();
  const pnl = positions.reduce((sum, position) => sum + position.profit + position.swap, 0);
  const currency = health.currency || "USD";
  return <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
    <div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-sm font-medium text-white">MT5 terminal</p><p className="mt-1 text-xs text-white/50">{loading ? "Connecting..." : health.connected ? `${health.login ?? "—"} · ${health.server ?? "Connected"}` : "Bridge offline"}</p></div><button type="button" onClick={() => void refresh()} className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-white/55">Refresh</button></div>
    {health.connected ? <div className="grid gap-3 md:grid-cols-3"><div><p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Balance</p><p className="mt-1 text-sm text-white">{currencyAmount(health.balance ?? 0, currency as "USD" | "USDT")}</p></div><div><p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Equity</p><p className="mt-1 text-sm text-white">{currencyAmount(health.equity ?? 0, currency as "USD" | "USDT")}</p></div><div><p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Open positions</p><p className="mt-1 text-sm text-white">{positions.length} · <span className={pnl >= 0 ? "text-emerald-400" : "text-red-400"}>{pnl >= 0 ? "+" : ""}{fmt.num(pnl)} {currency}</span></p></div></div> : <p className="text-sm text-white/55">Run the MT5 bridge on 127.0.0.1:8787 to detect the current terminal automatically.</p>}
  </div>;
}
export default function AccountSwitcher() {
  const { accounts, activeAccountId, activeAccount, setActiveAccountId, includedAccountIds, toggleAccountIncluded, deleteAccount, upsertAccount } = useTrades();
  const { health, initialDeposit } = useMt5();
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(false);
  const [modalPlatform, setModalPlatform] = useState<"manual" | "mt5">("manual");
  const label = activeAccountId === "all" ? { title: "All accounts", sub: `${includedAccountIds.length} included`, color: "#4f8cff", icon: <Layers3 className="h-4 w-4 text-white" /> } : activeAccount ? { title: activeAccount.name, sub: currencyAmount(activeAccount.initialBalance, activeAccount.currency), color: activeAccount.color, icon: <Wallet2 className="h-4 w-4 text-white" /> } : { title: "Select account", sub: "No account selected", color: "#7c8cff", icon: <Wallet2 className="h-4 w-4 text-white" /> };
  function linkCurrentMt5() {
    if (!health.login) return;
    const matches = accounts.filter(account => account.mt5Login === String(health.login) && (account.mt5Server ?? "") === (health.server ?? ""));
    if (matches.length === 1) { setActiveAccountId(matches[0].id); setOpen(false); return; }
    setModalPlatform("mt5"); setOpen(false); setModal(true);
  }
  return <>
    <div className="relative">
      <button type="button" onClick={() => setOpen(x => !x)} className="flex min-w-[220px] items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#11151b]/95 px-3 py-2.5 text-left"><div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${label.color}22` }}>{label.icon}</div><div className="min-w-0"><div className="truncate text-sm font-medium text-white">{label.title}</div><div className="truncate text-xs text-white/50">{label.sub}</div></div></div><ChevronDown className="h-4 w-4 text-white/45" /></button>
      {open ? <><button type="button" onClick={() => setOpen(false)} className="fixed inset-0 z-30 cursor-default" /><div className="absolute right-0 z-40 mt-3 w-[380px] rounded-[28px] border border-white/10 bg-[#0d1117] p-4 shadow-2xl">
        <div className="mb-4"><p className="text-[11px] uppercase tracking-[0.22em] text-white/35">Trading account manager</p><p className="mt-2 text-sm text-white/60">Choose active profile, include accounts in dashboard totals, or save MT5 profiles.</p></div>
        <div className="space-y-2"><button type="button" onClick={() => { setActiveAccountId("all"); setOpen(false); }} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left ${activeAccountId === "all" ? "bg-white/10" : "hover:bg-white/5"}`}><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#4f8cff22]"><Layers3 className="h-4 w-4 text-white" /></div><div className="min-w-0 flex-1"><div className="text-sm font-medium text-white">All accounts</div><div className="text-xs text-white/50">Combined · {includedAccountIds.length} included</div></div>{activeAccountId === "all" ? <Check className="h-4 w-4 text-emerald-300" /> : null}</button>
          {accounts.map(account => {
            const included = includedAccountIds.includes(account.id);
            return <div key={account.id} className="flex items-center gap-2 rounded-2xl px-2 py-2 hover:bg-white/[0.03]"><button type="button" onClick={() => { setActiveAccountId(account.id); setOpen(false); }} className="flex min-w-0 flex-1 items-center gap-3 text-left"><div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${account.color}22` }}><Wallet2 className="h-4 w-4 text-white" /></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-white">{account.name}</div><div className="truncate text-xs text-white/50">{kindLabel[account.kind]} · {currencyAmount(account.initialBalance, account.currency)}</div></div>{activeAccountId === account.id ? <Check className="h-4 w-4 text-emerald-300" /> : null}</button><button type="button" onClick={() => toggleAccountIncluded(account.id)} className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 text-white/65 hover:bg-white/5">{included ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}</button><button type="button" onClick={() => void deleteAccount(account.id)} className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-[#24151a] text-red-400 hover:bg-[#32181f]"><Trash2 className="h-4 w-4" /></button></div>;
          })}
        </div>
        <div className="my-4 border-t border-white/10" /><Mt5Panel />
        <div className="mt-4 grid gap-2"><button type="button" disabled={!health.connected} onClick={linkCurrentMt5} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left disabled:opacity-50"><div><div className="text-sm font-medium text-white">{health.connected ? "Link current MT5 terminal" : "MT5 terminal offline"}</div><div className="mt-1 text-xs text-white/50">Initial deposit: {initialDeposit ? currencyAmount(initialDeposit, health.currency === "USDT" ? "USDT" : "USD") : "waiting for history"}</div></div><Radio className="h-4 w-4 text-white/50" /></button><button type="button" onClick={() => { setModalPlatform("manual"); setOpen(false); setModal(true); }} className="flex items-center justify-between rounded-2xl border border-dashed border-white/15 px-4 py-3 text-left text-white/70 hover:bg-white/[0.03]"><div><div className="text-sm font-medium text-white">New account</div><div className="mt-1 text-xs text-white/50">Personal or prop · Manual journal or MT5 bridge</div></div><Plus className="h-4 w-4" /></button></div>
      </div></> : null}
    </div>
    {modal ? <NewAccountModal initialPlatform={modalPlatform} onClose={() => setModal(false)} mt5DefaultLogin={health.login ? String(health.login) : ""} mt5DefaultServer={health.server ?? ""} mt5DefaultBalance={initialDeposit ?? undefined} mt5BridgeConnected={Boolean(health.connected)} onCreate={async account => { const saved = await upsertAccount(account); setActiveAccountId(saved.id); }} /> : null}
  </>;
}
