import { JOURNAL_COLUMNS, type JournalColumnId } from './journal-layout';
import { shiftDay, startOfZonedDay } from './timezone';

export type JournalFilterKind = 'text' | 'number' | 'date';

export const NUMBER_COLUMNS: readonly JournalColumnId[] = ['entry_price', 'exit_price', 'risk_percent', 'net_pnl', 'result_r'];
export const DATE_COLUMNS: readonly JournalColumnId[] = ['opened_at', 'closed_at'];

export function journalFilterKind(id: JournalColumnId): JournalFilterKind {
  if (NUMBER_COLUMNS.includes(id)) return 'number';
  if (DATE_COLUMNS.includes(id)) return 'date';
  return 'text';
}

/**
 * Raw form values, exactly as typed by the user.
 * text: value; number: min/max as decimal strings; date: from/to as YYYY-MM-DD (inclusive days).
 */
export type JournalColumnFilter = { value?: string; min?: string; max?: string; from?: string; to?: string };
export type JournalFilters = Partial<Record<JournalColumnId, JournalColumnFilter>>;

function trimmed(value?: string): string { return (value ?? '').trim(); }

export function parseFilterNumber(value?: string): number | null {
  const text = trimmed(value).replace(',', '.');
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

/** Start of calendar day `value` (YYYY-MM-DD) in `tz` as UTC ms, or null for an empty/invalid day. */
export function parseFilterDay(value: string | undefined, tz: string): number | null {
  try { return startOfZonedDay(trimmed(value), tz); } catch { return null; }
}
/** Start of the day after `value` in `tz` (exclusive upper bound of an inclusive day range). */
function endOfFilterDay(value: string, tz: string): number | null {
  try { return startOfZonedDay(shiftDay(trimmed(value), 1), tz); } catch { return null; }
}

/** A filter is active when at least one of its bounds/values parses. Invalid input is ignored, not treated as "match nothing". */
export function isFilterActive(id: JournalColumnId, filter?: JournalColumnFilter): boolean {
  // Day validity does not depend on the zone, so UTC is enough to decide whether a date bound is set.
  if (!filter) return false;
  const kind = journalFilterKind(id);
  if (kind === 'number') return parseFilterNumber(filter.min) !== null || parseFilterNumber(filter.max) !== null;
  if (kind === 'date') return parseFilterDay(filter.from, 'UTC') !== null || parseFilterDay(filter.to, 'UTC') !== null;
  return trimmed(filter.value) !== '';
}

export function activeJournalFilters(filters: JournalFilters): [JournalColumnId, JournalColumnFilter][] {
  return JOURNAL_COLUMNS
    .map(column => column.id)
    .filter(id => isFilterActive(id, filters[id]))
    .map(id => [id, filters[id] as JournalColumnFilter]);
}

/**
 * @param numeric numeric value of the cell (null when missing)
 * @param dateMs timestamp of the cell for date columns (null when missing/invalid)
 * @param text searchable text of the cell for text columns
 * @param tz zone whose calendar days the date bounds refer to (the user's zone)
 * A row with a missing value never matches an active range bound.
 */
export function matchesJournalFilter(
  id: JournalColumnId,
  filter: JournalColumnFilter,
  cell: { numeric?: number | null; dateMs?: number | null; text?: string },
  tz: string,
): boolean {
  const kind = journalFilterKind(id);
  if (kind === 'number') {
    const min = parseFilterNumber(filter.min), max = parseFilterNumber(filter.max);
    if (min === null && max === null) return true;
    const value = cell.numeric;
    if (typeof value !== 'number' || !Number.isFinite(value)) return false;
    if (min !== null && value < min) return false;
    if (max !== null && value > max) return false;
    return true;
  }
  if (kind === 'date') {
    const from = parseFilterDay(filter.from, tz), to = filter.to ? endOfFilterDay(filter.to, tz) : null;
    if (from === null && to === null) return true;
    const value = cell.dateMs;
    if (typeof value !== 'number' || !Number.isFinite(value)) return false;
    if (from !== null && value < from) return false;
    if (to !== null && value >= to) return false;
    return true;
  }
  const needle = trimmed(filter.value).toLowerCase();
  if (!needle) return true;
  return (cell.text ?? '').toLowerCase().includes(needle);
}

/** Short human label for a filter chip, e.g. "≥ 10 … ≤ 50" or "з 2026-06-01". */
export function describeJournalFilter(id: JournalColumnId, filter: JournalColumnFilter): string {
  const kind = journalFilterKind(id);
  if (kind === 'number') {
    const min = parseFilterNumber(filter.min), max = parseFilterNumber(filter.max);
    if (min !== null && max !== null) return `${min} … ${max}`;
    return min !== null ? `≥ ${min}` : `≤ ${max}`;
  }
  if (kind === 'date') {
    const from = parseFilterDay(filter.from, 'UTC') !== null ? trimmed(filter.from) : '';
    const to = parseFilterDay(filter.to, 'UTC') !== null ? trimmed(filter.to) : '';
    if (from && to) return from === to ? from : `${from} — ${to}`;
    return from ? `з ${from}` : `по ${to}`;
  }
  return trimmed(filter.value);
}
