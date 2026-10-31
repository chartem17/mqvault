import type { ReactNode } from "react";
import type { RuleStatus } from "@/lib/strategy-control/types";
import { Panel } from "./primitives";

export const STRATEGY_SURFACE = "rounded-2xl border border-border bg-card p-5 shadow-sm";
export const statusTone: Record<RuleStatus, { chip: string; card: string; label: string }> = {
  ok: { chip: "border-green/20 bg-green/10 text-green", card: "border-border bg-card", label: "OK" },
  warning: { chip: "border-gold/20 bg-gold/10 text-gold", card: "border-gold/20 bg-gold/10", label: "Потребує уваги" },
  critical: { chip: "border-red/20 bg-red/10 text-red", card: "border-red/20 bg-red/10", label: "Негативний вплив" },
  insufficient: { chip: "border-border bg-muted text-muted-foreground", card: "border-border bg-card", label: "Мала вибірка" },
};
export const impactTone: Record<string, string> = {
  positive: "border-green/20 bg-green/10 text-green",
  negative: "border-red/20 bg-red/10 text-red",
  neutral: "border-border bg-muted text-muted-foreground",
  unknown: "border-border bg-muted text-muted-foreground",
};
export function StrategyMetricCard({ label, value, hint, icon, valueTone }: { label: string; value: string; hint?: string; icon: ReactNode; valueTone?: string }) {
  return <Panel className="p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</span><span className="text-muted-foreground">{icon}</span></div><div className={`text-3xl font-semibold tracking-tight ${valueTone ?? "text-foreground"}`}>{value}</div>{hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}</Panel>;
}
export function StrategySummaryMetric({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: string }) {
  return <div className="rounded-xl border border-border bg-muted/40 p-4"><div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div><div className={`mt-2 text-3xl font-semibold ${tone ?? "text-foreground"}`}>{value}</div><div className="mt-1 text-sm text-muted-foreground">{hint}</div></div>;
}
