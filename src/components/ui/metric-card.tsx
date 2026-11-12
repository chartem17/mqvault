import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Panel } from "./primitives";
import { CountUp } from "./count-up";

export const METRIC_STYLES = {
  standard: { root: "flex flex-col gap-1.5 p-4", header: "", label: "text-xs font-medium uppercase tracking-wider text-muted-foreground", value: "whitespace-nowrap text-[clamp(1rem,13cqi,1.5rem)] font-bold tabular-nums", hint: "text-xs text-muted-foreground" },
  compact: { root: "p-4", header: "", label: "text-[11px] uppercase tracking-wide text-muted-foreground", value: "mt-1 text-lg font-semibold", hint: "mt-0.5 text-[11px] text-muted-foreground" },
  dashboard: { root: "p-4 shadow-sm", header: "mb-3 flex items-center justify-between", label: "text-[11px] uppercase tracking-[0.18em] text-muted-foreground", value: "whitespace-nowrap text-[clamp(1.1rem,14cqi,1.875rem)] font-semibold tracking-tight text-foreground", hint: "mt-1 text-sm text-muted-foreground" },
  summary: { root: "rounded-xl bg-muted/40 p-4", header: "", label: "text-[11px] uppercase tracking-[0.16em] text-muted-foreground", value: "mt-2 whitespace-nowrap text-[clamp(1.1rem,14cqi,1.875rem)] font-semibold text-foreground", hint: "mt-1 text-sm text-muted-foreground" },
  pulse: { root: "p-4", header: "flex items-center justify-between gap-2", label: "text-xs uppercase tracking-wider text-muted-foreground", value: "mt-3 text-lg font-semibold", hint: "mt-1 text-xs" },
  detail: { root: "rounded-xl bg-secondary/30 p-3", header: "", label: "text-[10px] uppercase tracking-wider text-muted-foreground", value: "mt-1 text-sm", hint: "mt-1 text-xs text-muted-foreground" },
};
export type MetricCardProps = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  variant?: keyof typeof METRIC_STYLES;
  valueClassName?: string;
  valueColor?: string;
  hintColor?: string;
  iconColor?: string;
  className?: string;
};
export function MetricCard({ label, value, hint, icon, variant = "standard", valueClassName, valueColor, hintColor, iconColor, className }: MetricCardProps) {
  const styles = METRIC_STYLES[variant];
  // @container: values scale with the card width (cqi), so long amounts fit narrow phone tiles.
  return <Panel className={cn("@container min-w-0", styles.root, className)}><div className={styles.header}><p className={styles.label}>{label}</p>{icon && <span className="text-muted-foreground" style={iconColor ? { color: iconColor } : undefined}>{icon}</span>}</div><div className={cn(styles.value, valueClassName)} style={valueColor ? { color: valueColor } : undefined}>{typeof value === "string" ? <CountUp text={value} /> : value}</div>{hint ? <p className={styles.hint} style={hintColor ? { color: hintColor } : undefined}>{hint}</p> : null}</Panel>;
}
