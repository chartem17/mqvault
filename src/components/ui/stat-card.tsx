"use client";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatCard({
  label, value, sub, trend, colorClass, className,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | "neutral";
  colorClass?: string;
  className?: string;
}) {
  return (
    <div className={cn("bg-card rounded-xl border border-border p-4 flex flex-col gap-1.5", className)}>
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
      <p className={cn("text-2xl font-bold tabular-nums", colorClass)}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}