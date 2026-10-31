"use client";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { useMemo, useState, type ReactNode } from 'react';
import { Pencil, Plus, Search, Trash2, SlidersHorizontal, GripVertical } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui/primitives';
import { ManualTradeModal } from '@/components/journal/manual-trade-modal';
import { useTrades, type JournalTrade, type TradeInput, type UpdateTradeInput } from '@/hooks/use-trades';
import { useJournalLayout } from '@/hooks/use-journal-layout';
import { JOURNAL_COLUMNS, defaultJournalLayout, visibleJournalColumns, moveJournalColumn, toggleJournalColumn, type JournalColumnId } from '@/lib/journal-layout';
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
  const [fieldSearch, setFieldSearch] = useState('');
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState<JournalColumnId | null>(null);
  const [filters, setFilters] = useState<Partial<Record<JournalColumnId, string>>>({});
  const [filterSession, setFilterSession] = useState('All');
  const [sort, setSort] = useState<JournalColumnId>('opened_at');
  const [ascending, setAscending] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingTrade, setEditingTrade] = useState<JournalTrade | null>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const columns = visibleJournalColumns(prefs.layout);
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
      <div className="relative"><Button variant="secondary" size="sm" aria-expanded={panel} onClick={() => setPanel(!panel)}><SlidersHorizontal className="h-4 w-4" />Фільтри й колонки</Button>
        {panel && <section aria-label="Фільтри й колонки" onKeyDown={e => { if (e.key === 'Escape') setPanel(false); }} className="absolute right-0 top-full z-30 mt-2 w-[min(360px,85vw)] rounded-2xl border border-border bg-card p-3 shadow-2xl">
          <div className="mb-2 flex items-center gap-2"><Input aria-label="Пошук поля" placeholder="Знайти поле…" value={fieldSearch} onChange={e => setFieldSearch(e.target.value)} className="min-w-0 flex-1" /><Button variant="ghost" size="icon" aria-label="Закрити панель" onClick={() => setPanel(false)}>×</Button></div>
          <p className="mb-2 text-xs text-muted-foreground">Перемикач — видимість. Поле нижче — фільтр «містить». Приховування не скидає фільтр.</p>
          <div className="max-h-[50vh] space-y-2 overflow-y-auto">{prefs.layout.order.filter(id => labelFor(id).toLowerCase().includes(fieldSearch.toLowerCase())).map(id => <div key={id} className="rounded-xl border border-border p-2"><label className="flex items-center gap-2 text-sm"><Checkbox checked={!prefs.layout.hidden.includes(id)} disabled={!prefs.canEdit || (!prefs.layout.hidden.includes(id) && columns.length === 1)} onChange={() => prefs.change(toggleJournalColumn(prefs.layout, id))} />{labelFor(id)}</label><Input aria-label={`Фільтр ${labelFor(id)}`} value={filters[id] ?? ''} onChange={e => filter(id, e.target.value)} placeholder="Містить…" className="mt-2" /></div>)}</div>
          <label className="mt-3 block text-xs">Група / підсесія<Select aria-label="Фільтр сесії" value={filterSession} onChange={e => setFilterSession(e.target.value)} className="mt-1"><option value="All">Усі сесії</option>{SESSION_RULE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></label>
          <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={() => { setSearch(''); setFilters({}); setFilterSession('All'); }}>Скинути фільтри</Button>
        </section>}
      </div>
      {!editing && <Button variant="secondary" size="sm" disabled={!prefs.canEdit} onClick={() => setEditing(true)}>Впорядкувати колонки</Button>}
      <Button size="sm" onClick={() => { setEditingTrade(null); setShowModal(true); }}><Plus className="h-4 w-4" />Додати угоду</Button>
    </div>
    <div className="flex flex-wrap items-center gap-2 text-xs"><span className="text-muted-foreground">Сортування:</span><div><Select aria-label="Поле сортування" value={sort} onChange={e => setSort(e.target.value as JournalColumnId)}>{JOURNAL_COLUMNS.map(column => <option key={column.id} value={column.id}>{column.label}</option>)}</Select></div><Button variant="secondary" size="sm" onClick={() => setAscending(!ascending)}>{ascending ? 'За зростанням ↑' : 'За спаданням ↓'}</Button>{activeFilters.map(([id, value]) => <Button variant="secondary" size="sm" key={id} onClick={() => filter(id, '')}>{labelFor(id)}: {value} ×</Button>)}{filterSession !== 'All' && <Button variant="secondary" size="sm" onClick={() => setFilterSession('All')}>{filterSession} ×</Button>}</div>
    {(editing || prefs.dirty) && <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3"><p className="mr-auto text-xs">{editing ? 'Перетягніть заголовок або скористайтеся ← / →. Зміни ще не збережені.' : 'Видимість колонок змінена, але ще не збережена.'}</p><Button variant="secondary" size="sm" disabled={!prefs.canEdit} onClick={() => prefs.change(defaultJournalLayout())}>Стандартний вигляд</Button><Button variant="secondary" size="sm" disabled={prefs.saving} onClick={() => { prefs.cancel(); setEditing(false); setDragging(null); }}>Скасувати</Button><Button size="sm" disabled={!prefs.canEdit} onClick={async () => { if (await prefs.save()) { setEditing(false); setDragging(null); } }}>{prefs.saving ? 'Збереження…' : 'Підтвердити зміни'}</Button></div>}
    {prefs.loading && <p role="status" className="text-xs text-muted-foreground">Завантаження вигляду журналу…</p>}
    {prefs.error && <div role="alert" className="rounded-lg border border-border p-3 text-sm">{prefs.error}<Button variant="secondary" size="sm" className="ml-2" disabled={prefs.saving || prefs.loading} onClick={() => { setEditing(false); void prefs.reload(); }}>Перечитати й відкинути локальні зміни</Button></div>}
    {focus.kind !== 'none' && <div role={focus.kind === 'invalid' ? 'alert' : 'status'} className="rounded-xl border border-primary/20 bg-primary/5 p-4"><p>Доказові угоди зі Strategy Control</p>{focus.kind === 'invalid' ? <p>{focus.message}</p> : <p className="mt-1 text-xs">ID у посиланні: {focus.ids.length}. В активній вибірці: {focusedTrades.length}. Після фільтрів: {filtered.length}. Частина ID може бути недоступна в обраних рахунках.</p>}<p className="mt-1 text-xs text-muted-foreground">Фіксований перелік ID, без копіювання угод і розширення вибірки рахунків.</p>{onClearFocus && <Button variant="secondary" size="sm" onClick={onClearFocus} className="mt-2">Зняти фільтр доказових угод</Button>}</div>}
    {error && <div role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}</div>}
    <p role="status" className="text-xs text-muted-foreground">{copyStatus}</p>
    <div className="overflow-x-auto rounded-xl border border-border bg-card"><table className="w-full text-xs"><thead><tr className="border-b border-border">{columns.map((id, index) => <th key={id} scope="col" draggable={editing && prefs.canEdit} onDragStart={e => { if (!editing || !prefs.canEdit) { e.preventDefault(); return; } setDragging(id); e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => setDragging(null)} onDragOver={e => { if (editing && dragging && prefs.canEdit) e.preventDefault(); }} onDrop={e => { e.preventDefault(); if (dragging) move(dragging, id); setDragging(null); }} className={`whitespace-nowrap px-3 py-3 text-left font-semibold ${editing ? 'bg-primary/10 ring-1 ring-inset ring-primary/20' : 'text-muted-foreground'}`}><span className="inline-flex items-center gap-1">{editing && <GripVertical className="h-4 w-4 cursor-grab" />}{labelFor(id)}{editing && <><Button variant="ghost" size="sm" aria-label={`Перемістити ${id} ліворуч`} disabled={!prefs.canEdit || index === 0} onClick={() => move(id, columns[index - 1])}>←</Button><Button variant="ghost" size="sm" aria-label={`Перемістити ${id} праворуч`} disabled={!prefs.canEdit || index === columns.length - 1} onClick={() => move(id, columns[index + 1])}>→</Button></>}</span></th>)}<th scope="col" className="sticky right-0 bg-card px-3 py-3">Дії</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={columns.length + 1} className="p-8"><EmptyState title="Завантаження угод…" role="status" /></td></tr> : !filtered.length ? <tr><td colSpan={columns.length + 1} className="p-8"><EmptyState title="Угод за цими фільтрами немає." /></td></tr> : filtered.map((trade, index) => <tr key={trade.id} className={`border-b border-border/50 hover:bg-secondary/30 ${index % 2 ? 'bg-background/30' : ''}`}>{columns.map(id => <td key={id} className="whitespace-nowrap px-3 py-2">{cell(trade, id)}</td>)}<td className="sticky right-0 bg-card px-3 py-2"><div className="flex justify-end gap-2"><Button variant="ghost" size="icon" aria-label="Edit trade" onClick={() => { setEditingTrade(trade); setShowModal(true); }}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label="Delete trade" disabled={saving} onClick={() => void remove(trade.id)}><Trash2 className="h-4 w-4" /></Button></div></td></tr>)}
    </tbody></table></div>
    <ManualTradeModal open={showModal} accounts={accounts} defaultAccountId={activeAccountId !== 'all' ? activeAccountId : undefined} initialTrade={editingTrade} submitting={saving} onClose={() => { setShowModal(false); setEditingTrade(null); }} onSubmit={submit} />
  </div>;
}
