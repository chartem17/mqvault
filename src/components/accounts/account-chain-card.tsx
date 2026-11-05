"use client";
import { useMemo, useState } from "react";
import { Select } from "@/components/ui/primitives";
import { FORM_SURFACE as CARD } from "@/components/ui/form-styles";
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

  return <section className={CARD} aria-label="Гілка рахунку">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h3 className="font-semibold text-foreground">Гілка рахунку</h3><p className="mt-1 text-xs text-muted-foreground">Звʼяжіть Phase 1, Phase 2 і Funded, щоб бачити спільний прогрес. Це лише привʼязка: угоди й умови рахунків не змінюються.</p></div>
      <label className="space-y-1 text-xs text-muted-foreground"><span>Попередній етап цього рахунку</span>
        <Select aria-label="Попередній етап" value={account.parentAccountId ?? ""} disabled={saving} onChange={event => void changeParent(event.target.value)}>
          <option value="">Немає (початок гілки)</option>
          {candidates.map(item => <option key={item.id} value={item.id}>{item.name} · {phaseLabel[item.phase]}</option>)}
        </Select>
      </label>
    </div>
    {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    {chain.length > 1 ? <>
      <ol className="mt-4 space-y-2">{chain.map((stage, index) => {
        const own = buildAccountOverview(stage, trades);
        const current = stage.id === account.id;
        return <li key={stage.id} className={`rounded-xl border p-3 ${current ? "border-foreground/40" : "border-border"}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="text-foreground">{index + 1}. {stage.name} · {phaseLabel[stage.phase]}{current ? " (цей рахунок)" : ""}</span><span className="text-muted-foreground">Net P&L: {money(own.netPnl)} · угод: {own.tradeCount}</span></div>
          {own.progressPercent !== null && <div className="mt-2"><p className="text-xs text-muted-foreground">До цілі {stage.targetPercent}%: {fmt.pct(own.progressPercent)}</p><div role="progressbar" aria-label={`Прогрес до цілі: ${stage.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={own.progressPercent} className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-[var(--color-green)]" style={{ width: `${own.progressPercent}%` }} /></div></div>}
        </li>;
      })}</ol>
      <p className="mt-3 text-sm text-foreground">Разом по гілці: {money(total.netPnl)} · угод: {total.tradeCount} · торгових днів: {total.tradingDays}</p>
      {total.netPnl === null && <p className="mt-1 text-xs text-gold">У частині угод немає net P&L, тому сума недоступна.</p>}
      <p className="mt-1 text-xs text-muted-foreground">Торгові дні рахуються у вашому часовому поясі. Статусів «пройдено» чи «провалено» немає — лише дані журналу.</p>
    </> : <p className="mt-3 text-xs text-muted-foreground">Поки це окремий рахунок. Відкрийте наступний етап (наприклад Phase 2) і виберіть цей рахунок у полі «Попередній етап».</p>}
  </section>;
}
