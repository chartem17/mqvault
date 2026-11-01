"use client";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pencil, Plus, Search, Trash2, SlidersHorizontal, GripVertical, LayoutGrid, Table as TableIcon } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui/primitives';
import { ManualTradeModal } from '@/components/journal/manual-trade-modal';
import { useTrades, type JournalTrade, type TradeInput, type UpdateTradeInput } from '@/hooks/use-trades';
import { useJournalLayout } from '@/hooks/use-journal-layout';
import { JOURNAL_COLUMNS, defaultJournalLayout, visibleJournalColumns, moveJournalColumn, toggleJournalColumn, type JournalColumnId, type JournalViewMode } from '@/lib/journal-layout';
import { fmt } from '@/lib/utils-trade';
import { getSessionKey, getSessionGroup, getSessionLabel } from '@/lib/sessions';
import { matchesSessionSelection, SESSION_RULE_OPTIONS } from '@/lib/session-selection';
import { applyJournalFocus, NO_JOURNAL_FOCUS, type JournalFocus } from '@/lib/journal-focus';
const positive = 'var(--color-green)', negative = 'var(--color-red)';
function date(value?: string | null) { if (!value) return '—'; const d = new Date(value); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(); }
function session(trade: JournalTrade) { try { return getSessionLabel(trade.opened_at); } catch { return trade.session || '—'; } }
const labelFor = (id: JournalColumnId) => JOURNAL_COLUMNS.find(c => c.id === id)!.label;
export function JournalTab({ focus = NO_JOURNAL_FOCUS, onClearFocus }: { focus?: JournalFocus; onClearFocus?: () => void } = {}) {
  const { visibleTrades, accounts, activeAccountId, loading, saving, error, createTrade, updateTrade, deleteTrade } = useTrades();
  const prefs = useJournalLayout();
  const [search, setSearch] = useState('');
  const [panel, setPanel] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState<JournalColumnId | null>(null);
  const [filters, setFilters] = useState<Partial<Record<JournalColumnId, string>>>({});
  const [filterSession, setFilterSession] = useState('All');
  const [filterMarket, setFilterMarket] = useState('All');
  const [sort, setSort] = useState<JournalColumnId>('opened_at');
  const [ascending, setAscending] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingTrade, setEditingTrade] = useState<JournalTrade | null>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const panelRef = useRef<HTMLDivElement | null>(null);
  const columns = visibleJournalColumns(prefs.layout);
  const view = prefs.layout.view;
  function setView(next: JournalViewMode) { if (prefs.canEdit) prefs.change({ ...prefs.layout, view: next }); }
  const marketOptions = useMemo(() => Array.from(new Set(visibleTrades.map(trade => trade.market).filter((value): value is string => Boolean(value)))), [visibleTrades]);
  useEffect(() => {
    if (!panel) return;
    function onPointerDown(event: MouseEvent) { if (panelRef.current && !panelRef.current.contains(event.target as Node)) setPanel(false); }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [panel]);
  const focusedTrades = useMemo(() => applyJournalFocus(visibleTrades, focus), [visibleTrades, focus]);
  function accountName(id: string) { return accounts.find(account => account.id === id)?.name ?? 'Unknown'; }
  function raw(trade: JournalTrade, id: JournalColumnId): string | number | null {
    if (id === 'account_id') return accountName(trade.account_id);
    if (id === 'session') return session(trade);
    return trade[id] ?? null;
  }
  function searchable(trade: JournalTrade, id: JournalColumnId) {
    const value = raw(trade, id);
    return (id === 'opened_at' || id === 'closed_at') ? `${value ?? ''} ${date(typeof value === 'string' ? value : null)}` : String(value ?? '');
  }
  const activeFilters = Object.entries(filters).filter(([, value]) => value?.trim()) as [JournalColumnId, string][];
  const filtered = focusedTrades.filter(trade => {
    const q = search.trim().toLowerCase();
    if (q && ![...JOURNAL_COLUMNS.map(column => searchable(trade, column.id)), trade.notes, trade.entry_reason, trade.exit_reason].filter(Boolean).join(' ').toLowerCase().includes(q)) return false;
    if (activeFilters.some(([id, value]) => !searchable(trade, id).toLowerCase().includes(value.trim().toLowerCase()))) return false;
    if (filterSession !== 'All') {
      try { if (!matchesSessionSelection({ sessionKey: getSessionKey(trade.opened_at), sessionGroup: getSessionGroup(trade.opened_at) }, [filterSession])) return false; } catch { return false; }
    }
    if (filterMarket !== 'All' && trade.market !== filterMarket) return false;
    return true;
  }).sort((a, b) => {
    let left = raw(a, sort), right = raw(b, sort);
    if (sort === 'opened_at' || sort === 'closed_at') {
      left = typeof left === 'string' ? Date.parse(left) : null; right = typeof right === 'string' ? Date.parse(right) : null;
      if (typeof left === 'number' && !Number.isFinite(left)) left = null;
      if (typeof right === 'number' && !Number.isFinite(right)) right = null;
    }
    if (left === null && right === null) return a.id.localeCompare(b.id);
    if (left === null) return 1; if (right === null) return -1;
    const result = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right), undefined, { numeric: true });
    return (ascending ? result : -result) || a.id.localeCompare(b.id);
  });
  function filter(id: JournalColumnId, value: string) { setFilters(current => ({ ...current, [id]: value })); }
  function move(source: JournalColumnId, target?: JournalColumnId) { if (editing && target && prefs.canEdit) prefs.change(moveJournalColumn(prefs.layout, source, target)); }
  async function submit(values: TradeInput | UpdateTradeInput) { try { if ('id' in values) await updateTrade(values); else await createTrade({ ...values, source: 'manual' }); setShowModal(false); setEditingTrade(null); } catch { /* Hook exposes errors. */ } }
  async function remove(id: string) { try { await deleteTrade(id); } catch { /* Hook exposes errors. */ } }
  async function copy(id: string) { try { await navigator.clipboard.writeText(id); setCopyStatus('ID скопійовано'); } catch { setCopyStatus('Не вдалося скопіювати ID'); } }
  function cell(trade: JournalTrade, id: JournalColumnId): ReactNode {
    if (id === 'opened_at' || id === 'closed_at') return date(trade[id]);
    if (id === 'id') return <Button variant="ghost" size="sm" title={trade.id} aria-label={`Копіювати ID ${trade.id}`} onClick={() => void copy(trade.id)}>{trade.id.slice(0, 8)}</Button>;
    if (id === 'risk_percent') return typeof trade.risk_percent === 'number' ? `${trade.risk_percent}%` : '—';
    if (id === 'net_pnl' || id === 'result_r') { const value = trade[id]; return typeof value === 'number' ? <span style={{ color: value >= 0 ? positive : negative }}>{id === 'net_pnl' ? fmt.usd(value) : fmt.r(value)}</span> : '—'; }
    if (id === 'direction') return <span style={{ color: trade.direction === 'Long' ? positive : negative }}>{trade.direction}</span>;
    return raw(trade, id) ?? '—';
  }
  return <div className="space-y-4 p-6">
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Пошук угод" value={search} onChange={e => setSearch(e.target.value)} placeholder="Пошук угод, ID…" style={{ paddingLeft: '2.25rem' }} /></div>
      <div className="relative" ref={panelRef}><Button variant="secondary" size="sm" aria-expanded={panel} onClick={() => setPanel(!panel)}><SlidersHorizontal className="h-4 w-4" />Колонки</Button>
        {panel && <section aria-label="Видимість колонок" className="absolute right-0 top-full z-30 mt-2 w-[min(320px,85vw)] rounded-2xl border border-border bg-card p-3 shadow-2xl">
          <p className="mb-2 text-xs text-muted-foreground">Перемикач — видимість колонки.</p>
          <div className="max-h-[50vh] space-y-2 overflow-y-auto">{prefs.layout.order.map(id => <div key={id} className="rounded-xl border border-border p-2"><label className="flex items-center gap-2 text-sm"><Checkbox checked={!prefs.layout.hidden.includes(id)} disabled={!prefs.canEdit || (!prefs.layout.hidden.includes(id) && columns.length === 1)} onChange={() => prefs.change(toggleJournalColumn(prefs.layout, id))} />{labelFor(id)}</label></div>)}</div>
        </section>}
      </div>
      <Select aria-label="Фільтр ринку" value={filterMarket} onChange={e => setFilterMarket(e.target.value)} className="w-auto rounded-full"><option value="All">Усі ринки</option>{marketOptions.map(option => <option key={option} value={option}>{option}</option>)}</Select>
      <Select aria-label="Фільтр сесії" value={filterSession} onChange={e => setFilterSession(e.target.value)} className="w-auto rounded-full"><option value="All">Усі сесії</option>{SESSION_RULE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</Select>
      <div className="relative grid grid-cols-2 items-center rounded-full border border-border bg-secondary/60 p-1 text-xs" role="tablist" aria-label="Вигляд журналу">
        <span aria-hidden="true" className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-primary shadow transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] ${view === 'cards' ? 'translate-x-full' : 'translate-x-0'}`} />
        <button type="button" role="tab" aria-selected={view === 'table'} onClick={() => setView('table')} className={`relative z-10 flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 transition-colors ${view === 'table' ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}><TableIcon className="h-3.5 w-3.5" />Таблиця</button>
        <button type="button" role="tab" aria-selected={view === 'cards'} onClick={() => setView('cards')} className={`relative z-10 flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 transition-colors ${view === 'cards' ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}><LayoutGrid className="h-3.5 w-3.5" />Картки</button>
      </div>
      {view !== 'cards' && !editing && <Button variant="secondary" size="sm" disabled={!prefs.canEdit} onClick={() => setEditing(true)}>Впорядкувати колонки</Button>}
      <Button size="sm" onClick={() => { setEditingTrade(null); setShowModal(true); }}><Plus className="h-4 w-4" />Додати угоду</Button>
    </div>
    <div className="flex flex-wrap items-center gap-2 text-xs"><span className="text-muted-foreground">Сортування:</span><div><Select aria-label="Поле сортування" value={sort} onChange={e => setSort(e.target.value as JournalColumnId)}>{JOURNAL_COLUMNS.map(column => <option key={column.id} value={column.id}>{column.label}</option>)}</Select></div><Button variant="secondary" size="sm" onClick={() => setAscending(!ascending)}>{ascending ? 'За зростанням ↑' : 'За спаданням ↓'}</Button>{activeFilters.map(([id, value]) => <Button variant="secondary" size="sm" key={id} onClick={() => filter(id, '')}>{labelFor(id)}: {value} ×</Button>)}{filterSession !== 'All' && <Button variant="secondary" size="sm" onClick={() => setFilterSession('All')}>{filterSession} ×</Button>}{filterMarket !== 'All' && <Button variant="secondary" size="sm" onClick={() => setFilterMarket('All')}>{filterMarket} ×</Button>}</div>
    {prefs.loading && <p role="status" className="text-xs text-muted-foreground">Завантаження вигляду журналу…</p>}
    {prefs.error && <div role="alert" className="rounded-lg border border-border p-3 text-sm">{prefs.error}<Button variant="secondary" size="sm" className="ml-2" disabled={prefs.saving || prefs.loading} onClick={() => { setEditing(false); void prefs.reload(); }}>Перечитати й відкинути локальні зміни</Button></div>}
    {focus.kind !== 'none' && <div role={focus.kind === 'invalid' ? 'alert' : 'status'} className="rounded-xl border border-primary/20 bg-primary/5 p-4"><p>Доказові угоди зі Strategy Control</p>{focus.kind === 'invalid' ? <p>{focus.message}</p> : <p className="mt-1 text-xs">ID у посиланні: {focus.ids.length}. В активній вибірці: {focusedTrades.length}. Після фільтрів: {filtered.length}. Частина ID може бути недоступна в обраних рахунках.</p>}<p className="mt-1 text-xs text-muted-foreground">Фіксований перелік ID, без копіювання угод і розширення вибірки рахунків.</p>{onClearFocus && <Button variant="secondary" size="sm" onClick={onClearFocus} className="mt-2">Зняти фільтр доказових угод</Button>}</div>}
    {error && <div role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}</div>}
    <p role="status" className="text-xs text-muted-foreground">{copyStatus}</p>
    {view === 'cards' ? (
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
        {loading ? <EmptyState title="Завантаження угод…" role="status" className="col-span-full" /> : !filtered.length ? <EmptyState title="Угод за цими фільтрами немає." className="col-span-full" /> : filtered.map(trade => (
          <button key={trade.id} type="button" onClick={() => { setEditingTrade(trade); setShowModal(true); }} className="group overflow-hidden rounded-2xl border border-border bg-card text-left transition hover:border-primary/40 hover:shadow-lg">
            {trade.screenshot_url ? <img src={trade.screenshot_url} alt="" className="h-40 w-full object-cover" /> : <div className="flex h-40 items-center justify-center bg-secondary/40 text-xs text-muted-foreground">Немає скріншоту</div>}
            <div className="space-y-1 p-3">
              <div className="flex items-center justify-between"><span className="font-semibold">{trade.symbol}</span><span style={{ color: trade.direction === 'Long' ? positive : negative }}>{trade.direction}</span></div>
              <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{date(trade.opened_at)}</span><span style={{ color: (trade.net_pnl ?? 0) >= 0 ? positive : negative }}>{typeof trade.net_pnl === 'number' ? fmt.usd(trade.net_pnl) : '—'}</span></div>
              <div className="flex items-center justify-between text-xs"><span>R: {typeof trade.result_r === 'number' ? fmt.r(trade.result_r) : '—'}</span><span>{session(trade)}</span></div>
            </div>
          </button>
        ))}
      </div>
    ) : (
    <div className="overflow-x-auto rounded-xl border border-border bg-card"><table className="w-full text-xs"><thead><tr className="border-b border-border">{columns.map((id, index) => <th key={id} scope="col" draggable={editing && prefs.canEdit} onDragStart={e => { if (!editing || !prefs.canEdit) { e.preventDefault(); return; } setDragging(id); e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => setDragging(null)} onDragOver={e => { if (editing && dragging && prefs.canEdit) e.preventDefault(); }} onDrop={e => { e.preventDefault(); if (dragging) move(dragging, id); setDragging(null); }} className={`whitespace-nowrap px-3 py-3 text-left font-semibold ${editing ? 'bg-primary/10 ring-1 ring-inset ring-primary/20' : 'text-muted-foreground'}`}><span className="inline-flex items-center gap-1">{editing && <GripVertical className="h-4 w-4 cursor-grab" />}{labelFor(id)}{editing && <><Button variant="ghost" size="sm" aria-label={`Перемістити ${id} ліворуч`} disabled={!prefs.canEdit || index === 0} onClick={() => move(id, columns[index - 1])}>←</Button><Button variant="ghost" size="sm" aria-label={`Перемістити ${id} праворуч`} disabled={!prefs.canEdit || index === columns.length - 1} onClick={() => move(id, columns[index + 1])}>→</Button></>}</span></th>)}<th scope="col" className="sticky right-0 bg-card px-3 py-3">Дії</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={columns.length + 1} className="p-8"><EmptyState title="Завантаження угод…" role="status" /></td></tr> : !filtered.length ? <tr><td colSpan={columns.length + 1} className="p-8"><EmptyState title="Угод за цими фільтрами немає." /></td></tr> : filtered.map((trade, index) => <tr key={trade.id} className={`border-b border-border/50 hover:bg-secondary/30 ${index % 2 ? 'bg-background/30' : ''}`}>{columns.map(id => <td key={id} className="whitespace-nowrap px-3 py-2">{cell(trade, id)}</td>)}<td className="sticky right-0 bg-card px-3 py-2"><div className="flex justify-end gap-2"><Button variant="ghost" size="icon" aria-label="Edit trade" onClick={() => { setEditingTrade(trade); setShowModal(true); }}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label="Delete trade" disabled={saving} onClick={() => void remove(trade.id)}><Trash2 className="h-4 w-4" /></Button></div></td></tr>)}
    </tbody></table></div>
    )}
    <ManualTradeModal open={showModal} accounts={accounts} defaultAccountId={activeAccountId !== 'all' ? activeAccountId : undefined} initialTrade={editingTrade} submitting={saving} onClose={() => { setShowModal(false); setEditingTrade(null); }} onSubmit={submit} />
  </div>;
}
