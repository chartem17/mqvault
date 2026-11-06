import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const w = require("../.tmp-dashboard-layout-tests/dashboard-widgets.js");
const l = require("../.tmp-dashboard-layout-tests/dashboard-layout.js");

test("catalogue: unique keys, sane sizes, defaults inside the grid and without overlaps", () => {
  assert.equal(new Set(w.WIDGETS.map(x => x.key)).size, w.WIDGETS.length);
  for (const m of w.WIDGETS) { assert.ok(m.minW <= m.w && m.w <= m.maxW && m.maxW <= 12, m.key); assert.ok(m.minH <= m.h && m.h <= m.maxH, m.key); }
  const d = w.defaultDashboardLayout();
  assert.equal(d.items.length, w.WIDGETS.length);
  for (const a of d.items) assert.ok(a.x + a.w <= 12, a.key);
  assert.deepEqual(l.resolveOverlaps(d.items), d.items, "default layout must not overlap");
  assert.deepEqual(l.parseDashboardLayout(d), d);
});
test("strict parsing rejects malformed layouts", () => {
  const d = w.defaultDashboardLayout();
  const bad = [null, [], "x", { ...d, version: 2 }, { ...d, extra: 1 }, { ...d, items: "no" },
    { ...d, items: [{ key: "nope", x: 0, y: 0, w: 3, h: 2 }] },
    { ...d, items: [d.items[0], d.items[0]] },
    { ...d, items: [{ ...d.items[0], w: 1 }] }, { ...d, items: [{ ...d.items[0], w: 99 }] },
    { ...d, items: [{ ...d.items[0], x: 11 }] }, { ...d, items: [{ ...d.items[0], x: -1 }] },
    { ...d, items: [{ ...d.items[0], y: 1.5 }] }, { ...d, items: [{ ...d.items[0], y: 100000 }] },
    { ...d, items: [{ ...d.items[0], extra: true }] }, { ...d, mobile: "x" }, { ...d, mobile: [1] }, { ...d, mobile: ["net_pnl", "net_pnl"] }];
  for (const value of bad) assert.throws(() => l.parseDashboardLayout(value), undefined, JSON.stringify(value)?.slice(0, 60));
  assert.equal(l.parseDashboardLayout({ version: 1, items: [] }).items.length, 0);
});
test("stored garbage falls back to the default; overlaps are resolved", () => {
  assert.deepEqual(l.readStoredDashboardLayout({ nonsense: true }), w.defaultDashboardLayout());
  const parsed = l.parseDashboardLayout({ version: 1, items: [{ key: "net_pnl", x: 0, y: 0, w: 3, h: 2 }, { key: "winrate", x: 1, y: 0, w: 3, h: 2 }] });
  assert.equal(parsed.items[0].y, 0); assert.equal(parsed.items[1].y, 2);
});
test("add / remove / hidden keep layout and mobile order consistent", () => {
  let layout = w.defaultDashboardLayout();
  layout = l.removeWidget(layout, "equity");
  assert.equal(layout.items.some(i => i.key === "equity"), false); assert.equal(layout.mobile.includes("equity"), false);
  assert.deepEqual(l.hiddenWidgets(layout).map(m => m.key), ["equity"]);
  layout = l.addWidget(layout, "equity");
  const added = layout.items.find(i => i.key === "equity");
  assert.equal(added.w, 8); assert.equal(layout.mobile.at(-1), "equity");
  assert.equal(l.hiddenWidgets(layout).length, 0);
  assert.equal(l.addWidget(layout, "equity"), layout);
  assert.equal(l.addWidget(layout, "unknown"), layout);
  const placed = l.addWidget(l.removeWidget(layout, "calendar"), "calendar", { x: 99, y: 4 });
  assert.equal(placed.items.find(i => i.key === "calendar").x, 8);
});
test("grid positions are clamped to the catalogue and keep unknown keys out", () => {
  const d = w.defaultDashboardLayout();
  const next = l.applyGridPositions(d, [{ i: "net_pnl", x: 3, y: 5, w: 1, h: 9 }, { i: "ghost", x: 0, y: 0, w: 3, h: 3 }]);
  const item = next.items.find(i => i.key === "net_pnl");
  assert.equal(item.w, 2); assert.equal(item.h, 3); assert.equal(next.items.length, d.items.length);
  assert.doesNotThrow(() => l.parseDashboardLayout(next));
});
test("mobile reordering swaps neighbours and stops at the ends", () => {
  const d = w.defaultDashboardLayout();
  const first = d.mobile[0], second = d.mobile[1];
  const moved = l.moveMobile(d, first, 1);
  assert.deepEqual(moved.mobile.slice(0, 2), [second, first]);
  assert.equal(l.moveMobile(d, first, -1), d);
  assert.equal(l.moveMobile(d, d.mobile.at(-1), 1), d);
  assert.equal(l.moveMobile(d, "ghost", 1), d);
  assert.equal(l.sameLayout(d, l.parseDashboardLayout(d)), true); assert.equal(l.sameLayout(d, moved), false);
});
