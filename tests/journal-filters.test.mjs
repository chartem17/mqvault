import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const f = require('../.tmp-journal-filters-tests/journal-filters.js');

test('column kinds', () => {
  assert.equal(f.journalFilterKind('net_pnl'), 'number');
  assert.equal(f.journalFilterKind('result_r'), 'number');
  assert.equal(f.journalFilterKind('opened_at'), 'date');
  assert.equal(f.journalFilterKind('symbol'), 'text');
});

test('number range is inclusive and accepts comma decimals', () => {
  const filter = { min: '-10,5', max: '50' };
  assert.equal(f.matchesJournalFilter('net_pnl', filter, { numeric: -10.5 }), true);
  assert.equal(f.matchesJournalFilter('net_pnl', filter, { numeric: 50 }), true);
  assert.equal(f.matchesJournalFilter('net_pnl', filter, { numeric: 50.01 }), false);
  assert.equal(f.matchesJournalFilter('net_pnl', filter, { numeric: -11 }), false);
});

test('one-sided number bounds', () => {
  assert.equal(f.matchesJournalFilter('result_r', { min: '1' }, { numeric: 3 }), true);
  assert.equal(f.matchesJournalFilter('result_r', { min: '1' }, { numeric: 0.5 }), false);
  assert.equal(f.matchesJournalFilter('result_r', { max: '0' }, { numeric: -1 }), true);
});

test('missing value never matches an active range', () => {
  assert.equal(f.matchesJournalFilter('result_r', { min: '0' }, { numeric: null }), false);
  assert.equal(f.matchesJournalFilter('opened_at', { from: '2026-06-01' }, { dateMs: null }), false);
});

test('invalid or empty input is not an active filter', () => {
  assert.equal(f.isFilterActive('net_pnl', { min: 'abc', max: '' }), false);
  assert.equal(f.isFilterActive('opened_at', { from: '2026-02-30' }), false);
  assert.equal(f.isFilterActive('symbol', { value: '   ' }), false);
  assert.equal(f.matchesJournalFilter('net_pnl', { min: 'abc' }, { numeric: null }), true);
});

test('date range covers whole local days inclusively', () => {
  const filter = { from: '2026-06-08', to: '2026-06-08' };
  const start = new Date(2026, 5, 8, 0, 0, 0).getTime();
  const end = new Date(2026, 5, 8, 23, 59, 59, 999).getTime();
  assert.equal(f.matchesJournalFilter('opened_at', filter, { dateMs: start }), true);
  assert.equal(f.matchesJournalFilter('opened_at', filter, { dateMs: end }), true);
  assert.equal(f.matchesJournalFilter('opened_at', filter, { dateMs: end + 1 }), false);
  assert.equal(f.matchesJournalFilter('opened_at', filter, { dateMs: start - 1 }), false);
});

test('text filter is case-insensitive contains', () => {
  assert.equal(f.matchesJournalFilter('symbol', { value: 'xag' }, { text: 'XAGUSD' }), true);
  assert.equal(f.matchesJournalFilter('symbol', { value: 'eur' }, { text: 'XAGUSD' }), false);
});

test('active filters keep column order and labels describe bounds', () => {
  const active = f.activeJournalFilters({ result_r: { min: '1' }, opened_at: { from: '2026-06-01', to: '2026-06-19' }, symbol: { value: '' } });
  assert.deepEqual(active.map(([id]) => id), ['opened_at', 'result_r']);
  assert.equal(f.describeJournalFilter('opened_at', { from: '2026-06-01', to: '2026-06-19' }), '2026-06-01 — 2026-06-19');
  assert.equal(f.describeJournalFilter('result_r', { min: '1' }), '≥ 1');
  assert.equal(f.describeJournalFilter('net_pnl', { min: '-5', max: '5' }), '-5 … 5');
});
