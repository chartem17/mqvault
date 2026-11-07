"use client";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pencil, Plus, Search, Trash2, SlidersHorizontal, GripVertical, LayoutGrid, Table as TableIcon, Filter } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui/primitives';
import { ManualTradeModal } from '@/components/journal/manual-trade-modal';
import { useTrades, type JournalTrade, type TradeInput, type UpdateTradeInput } from '@/hooks/use-trades';
import { useJournalLayout } from '@/hooks/use-journal-layout';
import { PHONE_QUERY, useMediaQuery } from '@/hooks/use-media-query';
import { useI18n } from '@/components/providers/i18n-provider';
import { useTimezone } from '@/components/providers/timezone-provider';
import { formatDateTimeOrDash } from '@/lib/time/timezone';
import { JOURNAL_COLUMNS, defaultJournalLayout, visibleJournalColumns, moveJournalColumn, toggleJournalColumn, type JournalColumnId, type JournalLayout, type JournalViewMode } from '@/lib/journal/journal-layout';
import { fmt } from '@/lib/journal/utils-trade';
import { getSessionKey, getSessionGroup, getSessionLabel } from '@/lib/time/sessions';
import { matchesSessionSelection, SESSION_RULE_OPTIONS } from '@/lib/time/session-selection';
import { applyJournalFocus, MAX_JOURNAL_FOCUS_IDS, NO_JOURNAL_FOCUS, type JournalFocus } from '@/lib/journal/journal-focus';
import { activeJournalFilters, describeJournalFilter, journalFilterKind, matchesJournalFilter, type JournalColumnFilter, type JournalFilters } from '@/lib/journal/journal-filters';
const positive = 'var(--color-green)', negative = 'var(--color-red)';
function session(trade: JournalTrade) { try { return getSessionLabel(trade.opened_at); } catch { return trade.session || '—'; } }
const labelOf = (id: JournalColumnId) => JOURNAL_COLUMNS.find(c => c.id === id)!.label;
export function JournalTab({ focus = NO_JOURNAL_FOCUS, onClearFocus }: { focus?: JournalFocus; onClearFocus?: () => void } = {}) {
  const { visibleTrades, accounts, activeAccountId, loading, saving, error, createTrade, updateTrade, deleteTrade } = useTrades();
  const prefs = useJournalLayout();
  const { t, intl } = useI18n();
  const labelFor = (id: JournalColumnId) => t(labelOf(id));
  const { timezone } = useTimezone();
  const date = (value?: string | null) => formatDateTimeOrDash(value, timezone, intl);
  const [search, setSearch] = useState('');
  const [panel, setPanel] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editStart, setEditStart] = useState<JournalLayout | null>(null);
  const [dragging, setDragging] = useState<JournalColumnId | null>(null);
  const [filters, setFilters] = useState<JournalFilters>({});
  const [filterPanel, setFilterPanel] = useState(false);
  const [filterSession, setFilterSession] = useState('All');
  const [filterMarket, setFilterMarket] = useState('All');
  const [sort, setSort] = useState<JournalColumnId>('opened_at');
  const [ascending, setAscending] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingTrade, setEditingTrade] = useState<JournalTrade | null>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const panelRef = useRef<HTMLDivElement | null>(null);
  const filterPanelRef = useRef<HTMLDivElement | null>(null);
  const columns = visibleJournalColumns(prefs.layout);
  const phone = useMediaQuery(PHONE_QUERY);
  // Phones always get cards: a 15-column table cannot be read at 375px. The saved preference is untouched.
  const view: JournalViewMode = phone ? 'cards' : prefs.layout.view;
  function setView(next: JournalViewMode) {
    if (!prefs.canEdit) return;
    if (next === 'cards') { setPanel(false); finishEditing(); }
    prefs.change({ ...prefs.layout, view: next });
  }
  function startEditing() { if (!prefs.canEdit) return; setPanel(false); setEditStart(prefs.layout); setEditing(true); }
  function finishEditing() { setEditing(false); setEditStart(null); setDragging(null); if (prefs.dirty) void prefs.save(); }
  function cancelEditing() {
    if (editStart && prefs.canEdit) prefs.change({ ...prefs.layout, order: editStart.order });
    setEditing(false); setEditStart(null); setDragging(null);
  }
  function resetOrder() { if (prefs.canEdit) prefs.change({ ...prefs.layout, order: defaultJournalLayout().order }); }
  const marketOptions = useMemo(() => Array.from(new Set(visibleTrades.map(trade => trade.market).filter((value): value is string => Boolean(value)))), [visibleTrades]);
  useEffect(() => {
    if (!panel) return;
    function onPointerDown(event: MouseEvent) { if (panelRef.current && !panelRef.current.contains(event.target as Node)) setPanel(false); }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [panel]);
  useEffect(() => {
    if (!filterPanel) return;
    function onPointerDown(event: MouseEvent) { if (filterPanelRef.current && !filterPanelRef.current.contains(event.target as Node)) setFilterPanel(false); }
    function onKeyDown(event: KeyboardEvent) { if (event.key === 'Escape') setFilterPanel(false); }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('mousedown', onPointerDown); document.removeEventListener('keydown', onKeyDown); };
  }, [filterPanel]);
  useEffect(() => {
    if (!editing) return;
    function onKeyDown(event: KeyboardEvent) { if (event.key === 'Escape') { setEditing(false); setEditStart(null); setDragging(null); } }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [editing]);
  const focusedTrades = useMemo(() => applyJournalFocus(visibleTrades, focus), [visibleTrades, focus]);
  function accountName(id: string) { return accounts.find(account => account.id === id)?.name ?? t('Unknown account'); }
  function raw(trade: JournalTrade, id: JournalColumnId): string | number | null {
    if (id === 'account_id') return accountName(trade.account_id);
    if (id === 'session') return session(trade);
    return trade[id] ?? null;
  }
  function searchable(trade: JournalTrade, id: JournalColumnId) {
    const value = raw(trade, id);
    return (id === 'opened_at' || id === 'closed_at') ? `${value ?? ''} ${date(typeof value === 'string' ? value : null)}` : String(value ?? '');
  }
  const activeFilters = activeJournalFilters(filters);
  function filterCell(trade: JournalTrade, id: JournalColumnId) {
    const kind = journalFilterKind(id);
    if (kind === 'number') { const value = trade[id as keyof JournalTrade]; return { numeric: typeof value === 'number' ? value : null }; }
    if (kind === 'date') { const value = raw(trade, id); const ms = typeof value === 'string' ? Date.parse(value) : NaN; return { dateMs: Number.isFinite(ms) ? ms : null }; }
    return { text: searchable(trade, id) };
  }
  const filtered = focusedTrades.filter(trade => {
    const q = search.trim().toLowerCase();
    if (q && ![...JOURNAL_COLUMNS.map(column => searchable(trade, column.id)), trade.notes, trade.entry_reason, trade.exit_reason].filter(Boolean).join(' ').toLowerCase().includes(q)) return false;
    if (activeFilters.some(([id, value]) => !matchesJournalFilter(id, value, filterCell(trade, id), timezone))) return false;
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
  function setFilter(id: JournalColumnId, patch: JournalColumnFilter) { setFilters(current => ({ ...current, [id]: { ...current[id], ...patch } })); }
  function clearFilter(id: JournalColumnId) { setFilters(current => { const next = { ...current }; delete next[id]; return next; }); }
  function filterField(id: JournalColumnId) {
    const kind = journalFilterKind(id), value = filters[id] ?? {}, label = labelFor(id);
    if (kind === 'number') return <div className="grid grid-cols-2 gap-2"><Input inputMode="decimal" aria-label={t('{label}: from', { label })} placeholder={t('from')} value={value.min ?? ''} onChange={e => setFilter(id, { min: e.target.value })} /><Input inputMode="decimal" aria-label={t('{label}: to', { label })} placeholder={t('to')} value={value.max ?? ''} onChange={e => setFilter(id, { max: e.target.value })} /></div>;
    if (kind === 'date') return <div className="grid grid-cols-2 gap-2"><Input type="date" aria-label={t('{label}: from', { label })} value={value.from ?? ''} onChange={e => setFilter(id, { from: e.target.value })} /><Input type="date" aria-label={t('{label}: to', { label })} value={value.to ?? ''} onChange={e => setFilter(id, { to: e.target.value })} /></div>;
    return <Input aria-label={t('{label}: contains', { label })} placeholder={t('contains…')} value={value.value ?? ''} onChange={e => setFilter(id, { value: e.target.value })} />;
  }
  function move(source: JournalColumnId, target?: JournalColumnId) { if (editing && target && prefs.canEdit) prefs.change(moveJournalColumn(prefs.layout, source, target)); }
  async function submit(values: TradeInput | UpdateTradeInput) { try { if ('id' in values) await updateTrade(values); else await createTrade({ ...values, source: 'manual' }); setShowModal(false); setEditingTrade(null); } catch { /* Hook exposes errors. */ } }
  async function remove(id: string) { try { await deleteTrade(id); } catch { /* Hook exposes errors. */ } }
  async function copy(id: string) { try { await navigator.clipboard.writeText(id); setCopyStatus(t('ID copied')); } catch { setCopyStatus(t('Could not copy the ID')); } }
  function cell(trade: JournalTrade, id: JournalColumnId): ReactNode {
    if (id === 'opened_at' || id === 'closed_at') return date(trade[id]);
    if (id === 'id') return <Button variant="ghost" size="sm" title={trade.id} aria-label={t('Copy ID {id}', { id: trade.id })} onClick={() => void copy(trade.id)}>{trade.id.slice(0, 8)}</Button>;
    if (id === 'risk_percent') return typeof trade.risk_percent === 'number' ? `${trade.risk_percent}%` : '—';
    if (id === 'net_pnl' || id === 'result_r') { const value = trade[id]; return typeof value === 'number' ? <span style={{ color: value >= 0 ? positive : negative }}>{id === 'net_pnl' ? fmt.usd(value) : fmt.r(value)}</span> : '—'; }
    if (id === 'direction') return <span style={{ color: trade.direction === 'Long' ? positive : negative }}>{trade.direction}</span>;
    return raw(trade, id) ?? '—';
  }
  return <div className="space-y-4 sm:p-6">
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative order-1 w-[calc(100%-3rem)] min-w-0 sm:order-none sm:w-auto sm:min-w-[200px] sm:flex-1"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label={t("Search trades")} value={search} onChange={e => setSearch(e.target.value)} placeholder={t("Search trades, ID…")} style={{ paddingLeft: '2.25rem' }} /></div>
      <div className="relative order-3 shrink-0 sm:order-none" ref={filterPanelRef}><Button variant="secondary" size="sm" className="relative size-10 p-0 sm:size-auto sm:min-h-8 sm:px-3" aria-label={t("Filters")} title={t("Filters")} aria-expanded={filterPanel} onClick={() => { setPanel(false); setFilterPanel(!filterPanel); }}><Filter className="h-4 w-4" /><span className="hidden sm:inline">{t("Filters")}</span>{activeFilters.length > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground sm:static sm:ml-1">{activeFilters.length}</span>}</Button>
        {filterPanel && <section aria-label={t("Journal filters")} className="fixed inset-x-3 top-16 z-40 rounded-2xl sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:mt-2 sm:w-[360px] border border-border bg-card p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{t("Bounds are inclusive. An empty field means no limit.")}</p>{activeFilters.length > 0 && <Button variant="ghost" size="sm" onClick={() => setFilters({})}>{t("Reset all")}</Button>}</div>
          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">{JOURNAL_COLUMNS.filter(column => column.id !== 'id').map(column => <div key={column.id} className="space-y-1"><div className="flex items-center justify-between text-xs font-medium"><span>{t(column.label)}</span>{activeFilters.some(([id]) => id === column.id) && <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => clearFilter(column.id)}>{t("clear")}</button>}</div>{filterField(column.id)}</div>)}</div>
        </section>}
      </div>
      {view !== 'cards' && <div className="relative" ref={panelRef}><Button variant="secondary" size="sm" aria-expanded={panel} onClick={() => { setFilterPanel(false); setPanel(!panel); }}><SlidersHorizontal className="h-4 w-4" />{t("Columns")}</Button>
        {panel && <section aria-label={t("Column visibility")} className="absolute right-0 top-full z-30 mt-2 w-[min(320px,85vw)] rounded-2xl border border-border bg-card p-3 shadow-2xl">
          <p className="mb-2 text-xs text-muted-foreground">{t("The switch shows or hides a column.")}</p>
          <div className="max-h-[50vh] space-y-2 overflow-y-auto">{prefs.layout.order.map(id => <div key={id} className="rounded-xl border border-border p-2"><label className="flex items-center gap-2 text-sm"><Checkbox checked={!prefs.layout.hidden.includes(id)} disabled={!prefs.canEdit || (!prefs.layout.hidden.includes(id) && columns.length === 1)} onChange={() => prefs.change(toggleJournalColumn(prefs.layout, id))} />{labelFor(id)}</label></div>)}</div>
        </section>}
      </div>}
      <div className="order-4 flex min-w-0 flex-1 gap-2 sm:order-none sm:w-auto sm:flex-none">
        <Select aria-label={t("Market filter")} value={filterMarket} onChange={e => setFilterMarket(e.target.value)} className="min-w-0 flex-1 rounded-full sm:w-auto sm:flex-none"><option value="All">{t("All markets")}</option>{marketOptions.map(option => <option key={option} value={option}>{option}</option>)}</Select>
        <Select aria-label={t("Session filter")} value={filterSession} onChange={e => setFilterSession(e.target.value)} className="min-w-0 flex-1 rounded-full sm:w-auto sm:flex-none"><option value="All">{t("All sessions")}</option>{SESSION_RULE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</Select>
      </div>
      <div className="relative hidden grid-cols-2 items-center rounded-full border md:grid border-border bg-secondary/60 p-1 text-xs" role="tablist" aria-label={t("Journal view")}>
        <span aria-hidden="true" className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-primary shadow transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] ${view === 'cards' ? 'translate-x-full' : 'translate-x-0'}`} />
        <button type="button" role="tab" aria-selected={view === 'table'} onClick={() => setView('table')} className={`relative z-10 flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 transition-colors ${view === 'table' ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}><TableIcon className="h-3.5 w-3.5" />{t("Table")}</button>
        <button type="button" role="tab" aria-selected={view === 'cards'} onClick={() => setView('cards')} className={`relative z-10 flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 transition-colors ${view === 'cards' ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}><LayoutGrid className="h-3.5 w-3.5" />{t("Cards")}</button>
      </div>
      {view !== 'cards' && !editing && <Button variant="secondary" size="sm" disabled={!prefs.canEdit} onClick={startEditing}>{t("Reorder columns")}</Button>}
      <Button size="sm" className="order-2 size-10 p-0 sm:order-none sm:ml-auto sm:size-auto sm:px-3" aria-label={t("Add trade")} title={t("Add trade")} onClick={() => { setEditingTrade(null); setShowModal(true); }}><Plus className="h-4 w-4" /><span className="hidden sm:inline">{t("Add trade")}</span></Button>
    </div>
    {editing && view !== 'cards' && <div role="region" aria-label={t("Column order")} className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
      <span className="font-medium">{t("Column order")}</span>
      <span className="text-muted-foreground">{t("Drag a header or use the ← → arrows. Esc to finish.")}</span>
      <span role="status" className="text-muted-foreground">{prefs.saving ? t('Saving…') : prefs.dirty ? t('Unsaved changes') : t('Saved')}</span>
      <div className="ml-auto flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" disabled={!prefs.canEdit} onClick={resetOrder}>{t("Default order")}</Button>
        <Button variant="secondary" size="sm" disabled={!prefs.canEdit} onClick={cancelEditing}>{t("Discard changes")}</Button>
        <Button size="sm" disabled={prefs.saving} onClick={finishEditing}>{t("Done")}</Button>
      </div>
    </div>}
    <div className="flex flex-wrap items-center gap-2 text-xs"><span className="hidden text-muted-foreground sm:inline">{t("Sort:")}</span><div className="min-w-0 flex-1 sm:flex-none"><Select aria-label={t("Sort field")} value={sort} onChange={e => setSort(e.target.value as JournalColumnId)}>{JOURNAL_COLUMNS.map(column => <option key={column.id} value={column.id}>{t(column.label)}</option>)}</Select></div><Button variant="secondary" size="sm" className="min-h-10 sm:min-h-8" aria-label={ascending ? t('Ascending ↑') : t('Descending ↓')} onClick={() => setAscending(!ascending)}><span className="sm:hidden">{ascending ? '↑' : '↓'}</span><span className="hidden sm:inline">{ascending ? t('Ascending ↑') : t('Descending ↓')}</span></Button>{activeFilters.map(([id, value]) => <Button variant="secondary" size="sm" key={id} aria-label={t('Remove filter {name}', { name: labelFor(id) })} onClick={() => clearFilter(id)}>{labelFor(id)}: {describeJournalFilter(id, value)} ×</Button>)}{filterSession !== 'All' && <Button variant="secondary" size="sm" onClick={() => setFilterSession('All')}>{filterSession} ×</Button>}{filterMarket !== 'All' && <Button variant="secondary" size="sm" onClick={() => setFilterMarket('All')}>{filterMarket} ×</Button>}</div>
    {prefs.loading && <p role="status" className="text-xs text-muted-foreground">{t("Loading journal view…")}</p>}
    {prefs.error && <div role="alert" className="rounded-lg border border-border p-3 text-sm">{t(prefs.error)}<Button variant="secondary" size="sm" className="ml-2" disabled={prefs.saving || prefs.loading} onClick={() => { setEditing(false); void prefs.reload(); }}>{t('Reload and discard local changes')}</Button></div>}
    {focus.kind !== 'none' && <div role={focus.kind === 'invalid' ? 'alert' : 'status'} className="rounded-xl border border-primary/20 bg-primary/5 p-4"><p>{t("Evidence trades from Strategy Control")}</p>{focus.kind === 'invalid' ? <p>{t(focus.message, { max: MAX_JOURNAL_FOCUS_IDS })}</p> : <p className="mt-1 text-xs">{t("IDs in the link: {ids}. In the current selection: {selected}. After filters: {filtered}. Some IDs may be unavailable in the selected accounts.", { ids: focus.ids.length, selected: focusedTrades.length, filtered: filtered.length })}</p>}<p className="mt-1 text-xs text-muted-foreground">{t("A fixed list of IDs: trades are not copied and the account selection is not widened.")}</p>{onClearFocus && <Button variant="secondary" size="sm" onClick={onClearFocus} className="mt-2">{t("Clear the evidence-trade filter")}</Button>}</div>}
    {error && <div role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{t(error)}</div>}
    <p role="status" className="text-xs text-muted-foreground">{copyStatus}</p>
    {view === 'cards' ? (
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr))]">
        {loading ? <EmptyState title={t("Loading trades…")} role="status" className="col-span-full" /> : !filtered.length ? <EmptyState title={t("No trades match these filters.")} className="col-span-full" /> : filtered.map(trade => (
          <button key={trade.id} type="button" onClick={() => { setEditingTrade(trade); setShowModal(true); }} className="group overflow-hidden rounded-2xl border border-border bg-card text-left transition hover:border-primary/40 hover:shadow-lg">
            {trade.screenshot_url ? <img src={trade.screenshot_url} alt="" className="h-40 w-full object-cover" /> : <div className="hidden h-40 items-center justify-center bg-secondary/40 text-xs text-muted-foreground md:flex">{t("No screenshot")}</div>}
            <div className="space-y-1 p-3">
              <div className="flex items-center justify-between"><span className="font-semibold">{trade.symbol}</span><span style={{ color: trade.direction === 'Long' ? positive : negative }}>{trade.direction}</span></div>
              <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{date(trade.opened_at)}</span><span style={{ color: (trade.net_pnl ?? 0) >= 0 ? positive : negative }}>{typeof trade.net_pnl === 'number' ? fmt.usd(trade.net_pnl) : '—'}</span></div>
              <div className="flex items-center justify-between text-xs"><span>R: {typeof trade.result_r === 'number' ? fmt.r(trade.result_r) : '—'}</span><span>{session(trade)}</span></div>
            </div>
          </button>
        ))}
      </div>
    ) : (
    <div className="overflow-x-auto rounded-xl border border-border bg-card"><table className="w-full text-xs"><thead><tr className="border-b border-border">{columns.map((id, index) => <th key={id} scope="col" draggable={editing && prefs.canEdit} onDragStart={e => { if (!editing || !prefs.canEdit) { e.preventDefault(); return; } setDragging(id); e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => setDragging(null)} onDragOver={e => { if (editing && dragging && prefs.canEdit) e.preventDefault(); }} onDrop={e => { e.preventDefault(); if (dragging) move(dragging, id); setDragging(null); }} className={`whitespace-nowrap px-3 py-3 text-left font-semibold ${editing ? 'bg-primary/10 ring-1 ring-inset ring-primary/20' : 'text-muted-foreground'}`}><span className="inline-flex items-center gap-1">{editing && <GripVertical className="h-4 w-4 cursor-grab" />}{labelFor(id)}{editing && <><Button variant="ghost" size="sm" aria-label={t('Move {name} left', { name: labelFor(id) })} disabled={!prefs.canEdit || index === 0} onClick={() => move(id, columns[index - 1])}>←</Button><Button variant="ghost" size="sm" aria-label={t('Move {name} right', { name: labelFor(id) })} disabled={!prefs.canEdit || index === columns.length - 1} onClick={() => move(id, columns[index + 1])}>→</Button></>}</span></th>)}<th scope="col" className="sticky right-0 bg-card px-3 py-3">{t("Actions")}</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={columns.length + 1} className="p-8"><EmptyState title={t("Loading trades…")} role="status" /></td></tr> : !filtered.length ? <tr><td colSpan={columns.length + 1} className="p-8"><EmptyState title={t("No trades match these filters.")} /></td></tr> : filtered.map((trade, index) => <tr key={trade.id} className={`border-b border-border/50 hover:bg-secondary/30 ${index % 2 ? 'bg-background/30' : ''}`}>{columns.map(id => <td key={id} className="whitespace-nowrap px-3 py-2">{cell(trade, id)}</td>)}<td className="sticky right-0 bg-card px-3 py-2"><div className="flex justify-end gap-2"><Button variant="ghost" size="icon" aria-label={t("Edit trade")} onClick={() => { setEditingTrade(trade); setShowModal(true); }}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label={t("Delete trade")} disabled={saving} onClick={() => void remove(trade.id)}><Trash2 className="h-4 w-4" /></Button></div></td></tr>)}
    </tbody></table></div>
    )}
    <ManualTradeModal open={showModal} accounts={accounts} defaultAccountId={activeAccountId !== 'all' ? activeAccountId : undefined} initialTrade={editingTrade} submitting={saving} onClose={() => { setShowModal(false); setEditingTrade(null); }} onSubmit={submit} />
  </div>;
}
