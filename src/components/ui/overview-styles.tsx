import { Panel } from "./primitives";

export const CARD_SURFACE = "min-w-0 rounded-2xl border border-border bg-card text-card-foreground";
export const CARD_TITLE = "text-sm font-medium text-foreground";
export const LIST_ROW = "flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2.5";
export const EPISODE_TRIGGER = "group grid w-full grid-cols-1 gap-3 px-4 py-4 text-left transition hover:bg-secondary/30 md:grid-cols-[minmax(150px,1.1fr)_minmax(220px,2fr)_minmax(150px,1fr)_auto] md:items-center";
export const CHART_THEME = {
  gainArea: "color-mix(in oklab, var(--color-green) 12%, transparent)",
  lossArea: "color-mix(in oklab, var(--color-red) 12%, transparent)",
  gainGlow: "radial-gradient(circle at 20% 0%, color-mix(in oklab, var(--color-green) 7%, transparent), transparent 60%)",
  lossGlow: "radial-gradient(circle at 20% 0%, color-mix(in oklab, var(--color-red) 7%, transparent), transparent 60%)",
  pointFill: "var(--color-background)",
  tooltipBackground: "rgb(9 10 15 / 0.96)",
  tooltipBorder: "1px solid rgb(255 255 255 / 0.10)",
};
export function MetricTile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return <Panel className="p-4"><div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-1 text-lg font-semibold" style={{ color }}>{value}</div>{sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}</Panel>;
}
