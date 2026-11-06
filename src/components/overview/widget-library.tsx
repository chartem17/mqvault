"use client";
import { GripVertical, Plus } from "lucide-react";
import { GROUP_LABEL, hiddenKeysByGroup } from "@/components/overview/library-groups";
import type { WidgetMeta } from "@/lib/dashboard-widgets";

/** Side library: widgets that are not on the dashboard. Drag onto the grid (desktop) or press "Додати". */
export function WidgetLibrary({ hidden, onAdd, onDragKey }: { hidden: readonly WidgetMeta[]; onAdd: (key: string) => void; onDragKey: (key: string | null) => void }) {
  const groups = hiddenKeysByGroup(hidden);
  return <aside aria-label="Віджети" className="flex max-h-[70vh] min-h-0 flex-col gap-4 overflow-auto rounded-2xl border border-border bg-card p-4">
    <div><h3 className="m-0 text-sm font-semibold">Віджети</h3><p className="mt-1 text-xs text-muted-foreground">Ті, яких немає на дашборді. Перетягни на сітку або натисни «Додати».</p></div>
    {hidden.length === 0 && <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">Усі віджети вже на дашборді</p>}
    {groups.map(([group, items]) => <div key={group} className="space-y-2"><div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{GROUP_LABEL[group]}</div>
      {items.map(widget => <div key={widget.key} draggable onDragStart={event => { event.dataTransfer.setData("text/plain", widget.key); event.dataTransfer.effectAllowed = "copy"; onDragKey(widget.key); }} onDragEnd={() => onDragKey(null)} className="group flex cursor-grab items-center gap-2 rounded-xl border border-border bg-background/60 p-2.5 active:cursor-grabbing">
        <GripVertical className="hidden size-4 shrink-0 text-muted-foreground md:block" aria-hidden />
        <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{widget.title}</div><div className="truncate text-xs text-muted-foreground">{widget.description}</div></div>
        <button type="button" onClick={() => onAdd(widget.key)} aria-label={`Додати ${widget.title}`} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><Plus className="size-3.5" aria-hidden />Додати</button>
      </div>)}
    </div>)}
  </aside>;
}
