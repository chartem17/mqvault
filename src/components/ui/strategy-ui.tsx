import type { ReactNode } from "react";
import type { RuleStatus } from "@/lib/strategy-control/types";
import { MetricCard } from "./metric-card";
import { surfaceClass } from "./surface-styles";

export const STRATEGY_SURFACE = surfaceClass("p-5 shadow-sm");
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
  return <MetricCard variant="dashboard" label={label} value={value} hint={hint} icon={icon} valueClassName={valueTone} />;
}
export function StrategySummaryMetric({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: string }) {
  return <MetricCard variant="summary" label={label} value={value} hint={hint} valueClassName={tone} />;
}
