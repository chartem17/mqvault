"use client";
import { useMemo, useState } from "react";
import ReactGridLayout, { useContainerWidth, verticalCompactor } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { WIDGET_COMPONENTS } from "@/components/overview/widget-registry";
import { WidgetLibrary } from "@/components/overview/widget-library";
import { GRID_COLUMNS, GRID_GAP, ROW_HEIGHT, widgetMeta, type DashboardLayout } from "@/lib/dashboard-widgets";
import { addWidget, applyGridPositions, hiddenWidgets, moveMobile, removeWidget, sameLayout } from "@/lib/dashboard-layout";

const MOBILE_BREAKPOINT = 640;
/** Phone heights (px): charts need a fixed box to draw into, lists scroll inside it. */
const MOBILE_HEIGHT: Record<string, number> = { equity: 300, calendar: 480, drawdown: 560, r_distribution: 340, streaks: 120, monthly: 340, symbols: 360, sessions: 360, risk: 260, emotions: 320 };
const STAT_HEIGHT = 118;

function RemoveButton({ title, onClick }: { title: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} onMouseDown={event => event.stopPropagation()} aria-label={`Прибрати ${title}`} className="absolute right-2 top-2 z-20 inline-flex size-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><X className="size-4" aria-hidden /></button>;
}

export function DashboardGrid({ layout, onChange, editing }: { layout: DashboardLayout; onChange: (next: DashboardLayout) => void; editing: boolean }) {
  const { width, containerRef, mounted } = useContainerWidth();
  const [dragKey, setDragKey] = useState<string | null>(null);
  const hidden = hiddenWidgets(layout);
  const mobile = mounted && width < MOBILE_BREAKPOINT;
  const gridLayout = useMemo(() => layout.items.map(item => { const meta = widgetMeta(item.key); return { i: item.key, x: item.x, y: item.y, w: item.w, h: item.h, minW: meta?.minW, minH: meta?.minH, maxW: meta?.maxW, maxH: meta?.maxH }; }), [layout.items]);
  const dropMeta = dragKey ? widgetMeta(dragKey) : undefined;

  const commit = (next: DashboardLayout) => { if (!sameLayout(next, layout)) onChange(next); };
  const library = editing && <WidgetLibrary hidden={hidden} onAdd={key => onChange(addWidget(layout, key))} onDragKey={setDragKey} />;

  const body = mobile
    ? <ol className={`m-0 grid list-none grid-cols-2 p-0 ${editing ? "gap-2" : "gap-3"}`}>{layout.mobile.map((key, index) => { const Widget = WIDGET_COMPONENTS[key], meta = widgetMeta(key); if (!Widget || !meta) return null;
        const half = meta.group === "metrics" && key !== "streaks" && !editing;
        return <li key={key} className={`relative min-w-0 ${half ? "" : "col-span-2"}`}>{editing && <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2"><span className="truncate text-sm font-medium">{meta.title}</span><span className="flex shrink-0 gap-1">
          <button type="button" disabled={index === 0} onClick={() => onChange(moveMobile(layout, key, -1))} aria-label={`${meta.title}: вище`} className="inline-flex size-9 items-center justify-center rounded-lg border border-border disabled:opacity-40"><ArrowUp className="size-4" aria-hidden /></button>
          <button type="button" disabled={index === layout.mobile.length - 1} onClick={() => onChange(moveMobile(layout, key, 1))} aria-label={`${meta.title}: нижче`} className="inline-flex size-9 items-center justify-center rounded-lg border border-border disabled:opacity-40"><ArrowDown className="size-4" aria-hidden /></button>
          <button type="button" onClick={() => onChange(removeWidget(layout, key))} aria-label={`Прибрати ${meta.title}`} className="inline-flex size-9 items-center justify-center rounded-lg border border-border"><X className="size-4" aria-hidden /></button></span></div>}
          {!editing && <div style={{ height: MOBILE_HEIGHT[key] ?? STAT_HEIGHT }}><Widget /></div>}</li>; })}</ol>
    : <div className={`relative rounded-2xl ${editing ? "min-h-[320px] border-2 border-dashed border-border/70 p-2" : ""}`}>
        {editing && layout.items.length === 0 && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Перетягни віджет сюди</div>}
        {mounted && <ReactGridLayout width={Math.max(0, width - (editing ? 20 : 0))} layout={gridLayout}
          gridConfig={{ cols: GRID_COLUMNS, rowHeight: ROW_HEIGHT, margin: [GRID_GAP, GRID_GAP], containerPadding: [0, 0], maxRows: Infinity }}
          dragConfig={{ enabled: editing, handle: ".widget-drag-handle", bounded: false, threshold: 3 }}
          resizeConfig={{ enabled: editing, handles: ["se"] }}
          dropConfig={{ enabled: editing, defaultItem: { w: dropMeta?.w ?? 3, h: dropMeta?.h ?? 2 }, onDragOver: () => dropMeta ? { w: dropMeta.w, h: dropMeta.h } : false }}
          droppingItem={{ i: "__drop__", x: 0, y: 0, w: dropMeta?.w ?? 3, h: dropMeta?.h ?? 2 }}
          compactor={verticalCompactor}
          onLayoutChange={next => { if (editing) commit(applyGridPositions(layout, next)); }}
          onDrop={(_next, item) => { const key = dragKey; setDragKey(null); if (key && item) onChange(addWidget(layout, key, { x: item.x, y: item.y })); }}>
          {layout.items.map(item => { const Widget = WIDGET_COMPONENTS[item.key], meta = widgetMeta(item.key); if (!Widget || !meta) return <div key={item.key} />;
            return <div key={item.key} className={`min-h-0 min-w-0 ${editing ? "widget-drag-handle cursor-grab rounded-2xl ring-2 ring-primary/40 active:cursor-grabbing" : ""}`}>
              <div className={`h-full ${editing ? "pointer-events-none select-none" : ""}`}><Widget /></div>
              {editing && <RemoveButton title={meta.title} onClick={() => onChange(removeWidget(layout, item.key))} />}</div>; })}
        </ReactGridLayout>}
      </div>;

  return <div className={editing && !mobile ? "grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]" : ""}>
    <div ref={containerRef} className="min-w-0">{body}</div>
    {editing && <div className={mobile ? "mt-4" : ""}>{library}</div>}
  </div>;
}
