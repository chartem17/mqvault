import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { defaultJournalLayout, parseJournalLayout, visibleJournalColumns, moveJournalColumn, toggleJournalColumn } = require('../.tmp-journal-layout-tests/journal-layout.js');
test('defaults are independent and complete', () => { const a = defaultJournalLayout(), b = defaultJournalLayout(); a.order.reverse(); assert.equal(b.order[0], 'opened_at'); assert.equal(b.order.length, 15); });
test('move does not mutate input or lose fields', () => { const a = defaultJournalLayout(), b = moveJournalColumn(a, 'id', 'symbol'); assert.equal(b.order[3], 'id'); assert.equal(a.order[14], 'id'); assert.deepEqual([...a.order].sort(), [...b.order].sort()); });
test('hidden fields retain their position and cannot all disappear', () => { let a = defaultJournalLayout(); for (const id of a.order) a = toggleJournalColumn(a, id); assert.equal(visibleJournalColumns(a).length, 1); const b = toggleJournalColumn(a, 'opened_at'); assert.equal(b.order[0], 'opened_at'); assert.equal(b.hidden.includes('opened_at'), false); });
test('invalid layouts rejected', () => { const a = defaultJournalLayout(); for (const value of [null, [], {}, { ...a, version: 2 }, { ...a, user_id: 'foreign' }, { ...a, order: a.order.slice(1) }, { ...a, order: Array(15).fill('id') }, { ...a, hidden: a.order }, { ...a, hidden: ['unknown'] }, { ...a, hidden: ['id', 'id'] }]) assert.throws(() => parseJournalLayout(value)); });
