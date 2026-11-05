"use client";
import { useMemo, useState } from "react";
import { Select } from "@/components/ui/primitives";
import { useTimezone } from "@/components/providers/timezone-provider";
import { useTrades } from "@/hooks/use-trades";
import { phaseLabel, type TradingAccount } from "@/lib/account-data";
import { buildAccountOverview } from "@/lib/account-overview";
import { chainOf, linkError, summarizeChain } from "@/lib/account-chain";
import { fmt } from "@/lib/utils-trade";

/** Branch of linked prop stages (Phase 1 → Phase 2 → Funded): per-stage numbers and a combined journal summary. */
export function AccountChainCard({ account }: { account: TradingAccount }) {
  const { accounts, trades, refreshTrades } = useTrades();
  const { timezone } = useTimezone();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chain = useMemo(() => chainOf(account.id, accounts), [account.id, accounts]);
  const total = useMemo(() => summarizeChain(chain, trades, timezone), [chain, trades, timezone]);
  const candidates = useMemo(() => accounts.filter(item => item.id !== account.id && item.accountType === "prop" && (item.id === account.parentAccountId || linkError(account.id, item.id, accounts) === null)), [accounts, account.id, account.parentAccountId]);
  const money = (value: number | null) => value === null ? "—" : `${fmt.num(value, 2)} ${account.currency}`;

  async function changeParent(parentId: string) {
    setSaving(true); setError(null);
    try {
      const response = await fetch("/api/accounts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: account.id, parentAccountId: parentId || null }) });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Не вдалося змінити привʼязку");
      await refreshTrades();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не вдалося змінити привʼязку"); }
    finally { setSaving(false); }
  }

  return <section aria-label="Гілка рахунку" className="min-w-0 border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
    <div className="space-y-3">
      <div><p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Гілка</p><h3 className="mt-1 font-semibold text-foreground">Phase 1 → Phase 2 → Funded</h3></div>
      <label className="block space-y-1 text-xs text-muted-foreground"><span>Попередній етап цього рахунку</span>
        <Select aria-label="Попередній етап" value={account.parentAccountId ?? ""} disabled={saving} onChange={event => void changeParent(event.target.value)}>
          <option value="">Немає (початок гілки)</option>
          {candidates.map(item => <option key={item.id} value={item.id}>{item.name} · {phaseLabel[item.phase]}</option>)}
        </Select>
      </label>
    </div>
    {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    {chain.length > 1 ? <>
      <ol className="mt-4 space-y-0 border-l border-border pl-4">{chain.map(stage => {
        const own = buildAccountOverview(stage, trades);
        const current = stage.id === account.id;
        return <li key={stage.id} className="relative pb-3 last:pb-0">
          <span aria-hidden="true" className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border ${current ? "border-foreground bg-foreground" : "border-muted-foreground bg-background"}`} />
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm"><span className={current ? "font-medium text-foreground" : "text-foreground"}>{phaseLabel[stage.phase]} · {stage.name}</span><span className="text-xs text-muted-foreground">{money(own.netPnl)} · {own.tradeCount} угод</span></div>
          {own.progressPercent !== null && <div className="mt-2"><p className="text-xs text-muted-foreground">До цілі {stage.targetPercent}%: {fmt.pct(own.progressPercent)}</p><div role="progressbar" aria-label={`Прогрес до цілі: ${stage.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={own.progressPercent} className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-[var(--color-green)]" style={{ width: `${own.progressPercent}%` }} /></div></div>}
        </li>;
      })}</ol>
      <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-secondary/40 p-3 text-center"><div><p className="text-[11px] text-muted-foreground">Разом net P&L</p><p className="mt-0.5 text-sm font-semibold text-foreground">{money(total.netPnl)}</p></div><div><p className="text-[11px] text-muted-foreground">Угод</p><p className="mt-0.5 text-sm font-semibold text-foreground">{total.tradeCount}</p></div><div><p className="text-[11px] text-muted-foreground">Торг. днів</p><p className="mt-0.5 text-sm font-semibold text-foreground">{total.tradingDays}</p></div></div>
      {total.netPnl === null && <p className="mt-1 text-xs text-gold">У частині угод немає net P&L, тому сума недоступна.</p>}
      <p className="mt-2 text-xs text-muted-foreground">Дні — у вашому часовому поясі. Лише дані журналу, без статусів pass/fail.</p>
    </> : <p className="mt-3 text-xs text-muted-foreground">Поки окремий рахунок. Створіть наступний етап і виберіть цей рахунок у полі «Попередній етап» — тут зʼявиться спільний прогрес.</p>}
  </section>;
}
