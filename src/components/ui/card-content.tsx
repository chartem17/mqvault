import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { METRIC_STYLES } from "./metric-card";

export function CardLabel({ children }: { children: ReactNode }) {
  return <p className={METRIC_STYLES.standard.label}>{children}</p>;
}
export function CardValue({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn(METRIC_STYLES.standard.value, className)}>{children}</p>;
}
export function CardHint({ children }: { children: ReactNode }) {
  return <p className={METRIC_STYLES.standard.hint}>{children}</p>;
}
export function SectionHeading({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="text-base font-semibold text-foreground">{title}</h2>{sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}</div>{actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}</div>;
}
