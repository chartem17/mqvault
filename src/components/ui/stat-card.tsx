"use client";
import { MetricCard } from "./metric-card";
export function StatCard({ label, value, sub, colorClass, className }: { label: string; value: string; sub?: string; trend?: "up" | "down" | "neutral"; colorClass?: string; className?: string }) {
  return <MetricCard label={label} value={value} hint={sub} valueClassName={colorClass} className={className} />;
}
