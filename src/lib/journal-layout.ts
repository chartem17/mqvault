export const JOURNAL_COLUMNS = [
  { id: 'opened_at', label: 'Дата відкриття' },
  { id: 'closed_at', label: 'Дата закриття' },
  { id: 'account_id', label: 'Рахунок' },
  { id: 'symbol', label: 'Інструмент' },
  { id: 'market', label: 'Ринок' },
  { id: 'direction', label: 'Напрям' },
  { id: 'entry_price', label: 'Вхід' },
  { id: 'exit_price', label: 'Вихід' },
  { id: 'risk_percent', label: 'Ризик' },
  { id: 'net_pnl', label: 'P/L' },
  { id: 'result_r', label: 'R' },
  { id: 'session', label: 'Сесія' },
  { id: 'setup', label: 'Сетап' },
  { id: 'emotion', label: 'Емоція' },
  { id: 'id', label: 'ID угоди' },
] as const;
export type JournalColumnId = typeof JOURNAL_COLUMNS[number]['id'];
export type JournalViewMode = 'table' | 'cards';
export type JournalLayout = { version: 1; order: JournalColumnId[]; hidden: JournalColumnId[]; view: JournalViewMode };
export function defaultJournalLayout(): JournalLayout {
  return { version: 1, order: JOURNAL_COLUMNS.map(column => column.id), hidden: [], view: 'table' };
}
export function parseJournalLayout(value: unknown): JournalLayout {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid journal layout');
  const row = value as Record<string, unknown>;
  const allowed = new Set<string>(JOURNAL_COLUMNS.map(column => column.id));
  const validList = (items: unknown): items is JournalColumnId[] => Array.isArray(items) && items.every(item => typeof item === 'string' && allowed.has(item)) && new Set(items).size === items.length;
  const view = row.view === undefined ? 'table' : row.view;
  if (view !== 'table' && view !== 'cards') throw new Error('Invalid journal layout');
  if (Object.keys(row).some(key => !['version', 'order', 'hidden', 'view'].includes(key)) || row.version !== 1 || !validList(row.order) || row.order.length !== JOURNAL_COLUMNS.length || !validList(row.hidden) || row.hidden.length >= JOURNAL_COLUMNS.length) throw new Error('Invalid journal layout');
  return { version: 1, order: [...row.order], hidden: [...row.hidden], view };
}
export function visibleJournalColumns(layout: JournalLayout): JournalColumnId[] {
  const hidden = new Set(layout.hidden);
  return layout.order.filter(id => !hidden.has(id));
}
export function moveJournalColumn(layout: JournalLayout, source: JournalColumnId, target: JournalColumnId): JournalLayout {
  const next = parseJournalLayout(layout);
  const from = next.order.indexOf(source), to = next.order.indexOf(target);
  if (from < 0 || to < 0 || from === to) return next;
  const [id] = next.order.splice(from, 1);
  next.order.splice(to, 0, id);
  return next;
}
export function toggleJournalColumn(layout: JournalLayout, id: JournalColumnId): JournalLayout {
  const next = parseJournalLayout(layout);
  if (!next.order.includes(id)) return next;
  if (next.hidden.includes(id)) next.hidden = next.hidden.filter(item => item !== id);
  else if (next.hidden.length < next.order.length - 1) next.hidden.push(id);
  return next;
}
