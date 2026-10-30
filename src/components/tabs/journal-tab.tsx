"use client";
import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { ManualTradeModal } from "@/components/journal/manual-trade-modal";
import { useTrades, type JournalTrade, type TradeInput, type UpdateTradeInput } from "@/hooks/use-trades";
import { fmt } from "@/lib/utils-trade";
import { useInstruments } from "@/hooks/use-instruments";
import { marketsFrom } from "@/lib/markets";
import { getSessionKey, getSessionGroup, getSessionLabel } from "@/lib/sessions";
import { matchesSessionSelection, SESSION_RULE_OPTIONS } from "@/lib/session-selection";
import { applyJournalFocus, NO_JOURNAL_FOCUS, type JournalFocus } from "@/lib/journal-focus";

const POS = "var(--color-green)", NEG = "var(--color-red)";
const POS_BG = "color-mix(in srgb, var(--color-green) 14%, transparent)";
const NEG_BG = "color-mix(in srgb, var(--color-red) 14%, transparent)";
const SESSION_FILTER_OPTIONS = [{ value: "All", label: "All" }, ...SESSION_RULE_OPTIONS];
function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}
function tradeSessionLabel(trade: JournalTrade) {
  try { return getSessionLabel(trade.opened_at); } catch { return trade.session || "—"; }
}
function shortId(id: string) {
  return id.slice(0, 8);
}
function matchesSearch(trade: JournalTrade, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [trade.id, trade.opened_at, trade.closed_at, trade.symbol, trade.market, trade.direction, trade.session, tradeSessionLabel(trade), trade.setup, trade.emotion, trade.notes, trade.account_id, trade.entry_reason, trade.exit_reason].filter(Boolean).join(" ").toLowerCase().includes(q);
}
function sortTrades(a: JournalTrade, b: JournalTrade) {
  const aTime = new Date(a.opened_at).getTime(), bTime = new Date(b.opened_at).getTime();
  if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
  if (Number.isNaN(aTime)) return 1;
  if (Number.isNaN(bTime)) return -1;
  return bTime - aTime;
}
export function JournalTab({ focus = NO_JOURNAL_FOCUS, onClearFocus }: { focus?: JournalFocus; onClearFocus?: () => void } = {}) {
  const { visibleTrades, accounts, activeAccountId, loading, saving, error, createTrade, updateTrade, deleteTrade } = useTrades();
  const [search, setSearch] = useState("");
  const [filterMarket, setFilterMarket] = useState("All");
  const [filterSession, setFilterSession] = useState("All");
  const [showManualModal, setShowManualModal] = useState(false);
  const [editingTrade, setEditingTrade] = useState<JournalTrade | null>(null);
  const { instruments } = useInstruments();
  const marketOptions = useMemo(() => marketsFrom([...instruments.map(item => item.market), ...visibleTrades.map(trade => trade.market)]), [instruments, visibleTrades]);
  const focusedTrades = useMemo(() => applyJournalFocus(visibleTrades, focus), [visibleTrades, focus]);
  const filtered = useMemo(() => focusedTrades.filter(trade => {
    if (!matchesSearch(trade, search)) return false;
    if (filterMarket !== "All" && trade.market !== filterMarket) return false;
    if (filterSession === "All") return true;
    try {
      return matchesSessionSelection({ sessionKey: getSessionKey(trade.opened_at), sessionGroup: getSessionGroup(trade.opened_at) }, [filterSession]);
    } catch { return false; }
  }).sort(sortTrades), [focusedTrades, search, filterMarket, filterSession]);
  function accountName(id: string) { return accounts.find(account => account.id === id)?.name ?? "Unknown"; }
  async function handleSubmit(values: TradeInput | UpdateTradeInput) {
    try { if ("id" in values) await updateTrade(values); else await createTrade({ ...values, source: "manual" }); setShowManualModal(false); setEditingTrade(null); } catch { /* Hook state owns the error. */ }
  }
  async function handleDelete(id: string) { try { await deleteTrade(id); } catch { /* Hook state owns the error. */ } }
  return <div className="space-y-4 p-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-1 flex-wrap gap-2">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-border bg-secondary/60 px-3 py-1.5"><Search className="h-3.5 w-3.5 text-muted-foreground" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search trades..." className="flex-1 bg-transparent text-sm outline-none" />{search ? <button type="button" onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground" aria-label="Clear search"><X className="h-3.5 w-3.5" /></button> : null}</div>
        {["All", ...marketOptions].map(value => <button key={value} type="button" onClick={() => setFilterMarket(value)} className={`rounded-lg border px-3 py-1.5 text-xs ${filterMarket === value ? "border-primary/20 bg-primary/10 text-primary" : "border-border bg-secondary/60 text-muted-foreground"}`}>{value}</button>)}
        {SESSION_FILTER_OPTIONS.map(option => <button key={option.value} type="button" aria-pressed={filterSession === option.value} onClick={() => setFilterSession(option.value)} className={`rounded-lg border px-3 py-1.5 text-xs ${filterSession === option.value ? "border-primary/20 bg-primary/10 text-primary" : "border-border bg-secondary/60 text-muted-foreground"}`}>{option.label}</button>)}
      </div>
      <button type="button" onClick={() => { setEditingTrade(null); setShowManualModal(true); }} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"><Plus className="h-4 w-4" />Add trade</button>
    </div>
    {focus.kind !== "none" && <div role={focus.kind === "invalid" ? "alert" : "status"} className="rounded-xl border border-primary/20 bg-primary/5 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-medium">Доказові угоди зі Strategy Control</p>{focus.kind === "invalid" ? <p className="mt-1 text-sm text-destructive">{focus.message}</p> : loading ? <p className="mt-1 text-sm text-muted-foreground">Завантаження вибірки…</p> : <><p className="mt-1 text-sm text-muted-foreground">ID у посиланні: {focus.ids.length}. В активній вибірці рахунків: {focusedTrades.length}. Після додаткових фільтрів: {filtered.length}.</p>{focusedTrades.length < focus.ids.length && <p className="mt-1 text-xs text-muted-foreground">Частина угод недоступна або не входить до активного рахунку чи включених рахунків. Вибірку автоматично не розширено.</p>}</>}<p className="mt-2 text-xs text-muted-foreground">Це фіксований перелік ID, не копії угод і не повторний запуск правил. Нові угоди автоматично до нього не додаються.</p></div>{onClearFocus && <button type="button" onClick={onClearFocus} className="rounded-lg border border-border bg-background px-3 py-2 text-xs">Зняти фільтр доказових угод</button>}</div></div>}
    {error ? <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-4"><p className="text-sm text-red-300">{error}</p></div> : null}
    <div className="overflow-x-auto rounded-xl border border-border bg-card"><table className="w-full text-xs">
      <thead><tr className="border-b border-border">{["OPEN AT", "CLOSE AT", "ACCOUNT", "SYMBOL", "MARKET", "DIR", "ENTRY", "EXIT", "RISK", "P/L", "R", "SESSION", "SETUP", "EMOTION", "TRADE ID", ""].map(header => <th key={header} className="whitespace-nowrap px-3 py-2.5 text-left font-semibold uppercase tracking-wider text-muted-foreground">{header}</th>)}</tr></thead>
      <tbody>
        {loading ? Array.from({ length: 8 }).map((_, index) => <tr key={index} className="border-b border-border/50"><td colSpan={16} className="px-3 py-3"><div className="grid grid-cols-8 gap-3">{Array.from({ length: 8 }).map((__, cell) => <div key={cell} className="h-4 rounded bg-secondary/60" />)}</div></td></tr>) : filtered.length === 0 ? <tr><td colSpan={16} className="px-4 py-10 text-center text-sm text-muted-foreground">{focus.kind === "ids" && focus.ids.length === 0 ? "У цьому результаті немає доказових угод." : "No trades found for the current filters."}</td></tr> : filtered.map((trade, index) => <tr key={trade.id} className={`border-b border-border/50 hover:bg-secondary/30 ${index % 2 ? "bg-background/30" : ""}`}>
          <td className="whitespace-nowrap px-3 py-2 font-mono">{formatDateTime(trade.opened_at)}</td>
          <td className="whitespace-nowrap px-3 py-2 font-mono text-muted-foreground">{formatDateTime(trade.closed_at)}</td>
          <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{accountName(trade.account_id)}</td>
          <td className="whitespace-nowrap px-3 py-2 font-mono font-semibold">{trade.symbol}</td>
          <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{trade.market || "—"}</td>
          <td className="whitespace-nowrap px-3 py-2"><span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: trade.direction === "Long" ? POS_BG : NEG_BG, color: trade.direction === "Long" ? POS : NEG }}>{trade.direction}</span></td>
          <td className="whitespace-nowrap px-3 py-2 font-mono">{trade.entry_price ?? "—"}</td>
          <td className="whitespace-nowrap px-3 py-2 font-mono">{trade.exit_price ?? "—"}</td>
          <td className="whitespace-nowrap px-3 py-2 font-mono">{typeof trade.risk_percent === "number" ? `${trade.risk_percent}%` : "—"}</td>
          <td className="whitespace-nowrap px-3 py-2 font-mono font-semibold" style={{ color: (trade.net_pnl ?? 0) >= 0 ? POS : NEG }}>{typeof trade.net_pnl === "number" ? fmt.usd(trade.net_pnl) : "—"}</td>
          <td className="whitespace-nowrap px-3 py-2 font-mono" style={{ color: (trade.result_r ?? 0) >= 0 ? POS : NEG }}>{typeof trade.result_r === "number" ? fmt.r(trade.result_r) : "—"}</td>
          <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{tradeSessionLabel(trade)}</td>
          <td className="whitespace-nowrap px-3 py-2">{trade.setup || "—"}</td>
          <td className="whitespace-nowrap px-3 py-2">{trade.emotion || "—"}</td>
          <td className="whitespace-nowrap px-3 py-2"><button type="button" onClick={() => void navigator.clipboard?.writeText(trade.id)} className="rounded px-1.5 py-0.5 font-mono text-muted-foreground transition hover:bg-secondary hover:text-foreground" title={trade.id} aria-label={`Copy trade ID ${shortId(trade.id)}`}>{shortId(trade.id)}</button></td>
          <td className="whitespace-nowrap px-3 py-2"><div className="flex items-center justify-end gap-1"><button type="button" onClick={() => { setEditingTrade(trade); setShowManualModal(true); }} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Edit trade"><Pencil className="h-3.5 w-3.5" /></button><button type="button" onClick={() => void handleDelete(trade.id)} disabled={saving} className="rounded p-1 text-muted-foreground hover:text-red-400 disabled:opacity-50" aria-label="Delete trade"><Trash2 className="h-3.5 w-3.5" /></button></div></td>
        </tr>)}
      </tbody>
    </table></div>
    <ManualTradeModal open={showManualModal} accounts={accounts} defaultAccountId={activeAccountId !== "all" ? activeAccountId : undefined} initialTrade={editingTrade} submitting={saving} onClose={() => { setShowManualModal(false); setEditingTrade(null); }} onSubmit={handleSubmit} />
  </div>;
}
