import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Panel } from "./primitives";

export const METRIC_STYLES = {
  standard: { root: "flex flex-col gap-1.5 p-4", header: "", label: "text-xs font-medium uppercase tracking-wider text-muted-foreground", value: "text-2xl font-bold tabular-nums", hint: "text-xs text-muted-foreground" },
  compact: { root: "p-4", header: "", label: "text-[11px] uppercase tracking-wide text-muted-foreground", value: "mt-1 text-lg font-semibold", hint: "mt-0.5 text-[11px] text-muted-foreground" },
  dashboard: { root: "p-4 shadow-sm", header: "mb-3 flex items-center justify-between", label: "text-[11px] uppercase tracking-[0.18em] text-muted-foreground", value: "text-3xl font-semibold tracking-tight text-foreground", hint: "mt-1 text-sm text-muted-foreground" },
  summary: { root: "rounded-xl bg-muted/40 p-4", header: "", label: "text-[11px] uppercase tracking-[0.16em] text-muted-foreground", value: "mt-2 text-3xl font-semibold text-foreground", hint: "mt-1 text-sm text-muted-foreground" },
};
export type MetricCardProps = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  variant?: keyof typeof METRIC_STYLES;
  valueClassName?: string;
  valueColor?: string;
  className?: string;
};
export function MetricCard({ label, value, hint, icon, variant = "standard", valueClassName, valueColor, className }: MetricCardProps) {
  const styles = METRIC_STYLES[variant];
  return <Panel className={cn(styles.root, className)}><div className={styles.header}><p className={styles.label}>{label}</p>{icon && <span className="text-muted-foreground">{icon}</span>}</div><div className={cn(styles.value, valueClassName)} style={valueColor ? { color: valueColor } : undefined}>{value}</div>{hint ? <p className={styles.hint}>{hint}</p> : null}</Panel>;
}
