import { GRID_COLUMNS, WIDGETS, defaultDashboardLayout, readingOrder, widgetMeta, type DashboardLayout, type LayoutItem, type WidgetMeta } from "./dashboard-widgets";

const MAX_Y = 999;
const isInt = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value);

function collides(a: LayoutItem, b: LayoutItem) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }

/** Pushes overlapping items down so every item has its own cells (the grid library compacts upwards afterwards). */
export function resolveOverlaps(items: readonly LayoutItem[]): LayoutItem[] {
  const placed: LayoutItem[] = [];
  for (const source of [...items].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const item = { ...source };
    for (let guard = 0; guard < 200; guard++) {
      const hit = placed.find(other => collides(item, other));
      if (!hit) break;
      item.y = hit.y + hit.h;
    }
    placed.push(item);
  }
  return items.map(original => placed.find(item => item.key === original.key) as LayoutItem);
}

function normalise(items: LayoutItem[], mobile: readonly string[]): DashboardLayout {
  const resolved = resolveOverlaps(items);
  const present = new Set(resolved.map(item => item.key));
  const order = [...new Set(mobile.filter(key => present.has(key)))];
  for (const key of readingOrder(resolved)) if (!order.includes(key)) order.push(key);
  return { version: 1, items: resolved, mobile: order };
}

/** Strict parser for data coming from the client: any malformed value is rejected. */
export function parseDashboardLayout(value: unknown): DashboardLayout {
  const fail = () => { throw new Error("Invalid dashboard layout"); };
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail();
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some(key => !["version", "items", "mobile"].includes(key)) || row.version !== 1) return fail();
  if (!Array.isArray(row.items) || row.items.length > WIDGETS.length) return fail();
  const seen = new Set<string>();
  const items = row.items.map((raw): LayoutItem => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail();
    const item = raw as Record<string, unknown>;
    if (Object.keys(item).some(key => !["key", "x", "y", "w", "h"].includes(key))) return fail();
    const meta = typeof item.key === "string" ? widgetMeta(item.key) : undefined;
    if (!meta || seen.has(meta.key)) return fail();
    seen.add(meta.key);
    const { x, y, w, h } = item;
    if (!isInt(x) || !isInt(y) || !isInt(w) || !isInt(h)) return fail();
    if (w < meta.minW || w > Math.min(meta.maxW, GRID_COLUMNS) || h < meta.minH || h > meta.maxH || x < 0 || x + w > GRID_COLUMNS || y < 0 || y > MAX_Y) return fail();
    return { key: meta.key, x, y, w, h };
  });
  let mobile: string[] = [];
  if (row.mobile !== undefined) {
    if (!Array.isArray(row.mobile) || row.mobile.some(key => typeof key !== "string") || new Set(row.mobile).size !== row.mobile.length) return fail();
    mobile = row.mobile as string[];
  }
  return normalise(items, mobile);
}

/** Lenient reader for stored data: anything unreadable falls back to the default arrangement. */
export function readStoredDashboardLayout(value: unknown): DashboardLayout {
  try { return parseDashboardLayout(value); } catch { return defaultDashboardLayout(); }
}

export function hiddenWidgets(layout: DashboardLayout): WidgetMeta[] {
  const used = new Set(layout.items.map(item => item.key));
  return WIDGETS.filter(widget => !used.has(widget.key));
}

/** Adds a widget below everything else at its default size. */
export function addWidget(layout: DashboardLayout, key: string, at?: { x: number; y: number }): DashboardLayout {
  const meta = widgetMeta(key);
  if (!meta || layout.items.some(item => item.key === key)) return layout;
  const bottom = layout.items.reduce((max, item) => Math.max(max, item.y + item.h), 0);
  const x = at ? Math.min(Math.max(0, at.x), GRID_COLUMNS - meta.w) : 0;
  return normalise([...layout.items, { key, x, y: at ? Math.max(0, at.y) : bottom, w: meta.w, h: meta.h }], [...layout.mobile, key]);
}

export function removeWidget(layout: DashboardLayout, key: string): DashboardLayout {
  return normalise(layout.items.filter(item => item.key !== key), layout.mobile.filter(entry => entry !== key));
}

/** Takes positions reported by the grid; unknown keys are ignored, sizes are clamped to the catalogue. */
export function applyGridPositions(layout: DashboardLayout, positions: readonly { i: string; x: number; y: number; w: number; h: number }[]): DashboardLayout {
  const byKey = new Map(positions.map(position => [position.i, position]));
  const items = layout.items.map(item => {
    const next = byKey.get(item.key), meta = widgetMeta(item.key);
    if (!next || !meta) return item;
    const w = Math.min(Math.max(Math.round(next.w), meta.minW), Math.min(meta.maxW, GRID_COLUMNS));
    const h = Math.min(Math.max(Math.round(next.h), meta.minH), meta.maxH);
    return { key: item.key, w, h, x: Math.min(Math.max(0, Math.round(next.x)), GRID_COLUMNS - w), y: Math.min(Math.max(0, Math.round(next.y)), MAX_Y) };
  });
  return normalise(items, layout.mobile);
}

/** Mobile list: moves a widget one place up or down. */
export function moveMobile(layout: DashboardLayout, key: string, direction: -1 | 1): DashboardLayout {
  const index = layout.mobile.indexOf(key), target = index + direction;
  if (index < 0 || target < 0 || target >= layout.mobile.length) return layout;
  const mobile = [...layout.mobile];
  [mobile[index], mobile[target]] = [mobile[target], mobile[index]];
  return { ...layout, mobile };
}

export function sameLayout(a: DashboardLayout, b: DashboardLayout): boolean {
  return JSON.stringify({ items: [...a.items].sort((x, y) => x.key.localeCompare(y.key)), mobile: a.mobile }) === JSON.stringify({ items: [...b.items].sort((x, y) => x.key.localeCompare(y.key)), mobile: b.mobile });
}
