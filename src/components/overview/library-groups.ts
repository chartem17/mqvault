import { GROUP_LABEL, type WidgetGroup, type WidgetMeta } from "@/lib/dashboard/dashboard-widgets";

export { GROUP_LABEL };
export function hiddenKeysByGroup(hidden: readonly WidgetMeta[]): [WidgetGroup, WidgetMeta[]][] {
  const order: WidgetGroup[] = ["metrics", "charts", "breakdowns"];
  return order.map((group): [WidgetGroup, WidgetMeta[]] => [group, hidden.filter(widget => widget.group === group)]).filter(([, items]) => items.length > 0);
}
