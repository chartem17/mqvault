"use client";
import { cn } from "@/lib/utils";
import { Panel } from "./primitives";
import { CardHint, CardLabel, CardValue } from "./card-content";

export function StatCard({
  label, value, sub, colorClass, className,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | "neutral";
  colorClass?: string;
  className?: string;
}) {
  return (
    <Panel className={cn("flex flex-col gap-1.5 p-4", className)}>
      <CardLabel>{label}</CardLabel>
      <CardValue className={colorClass}>{value}</CardValue>
      {sub && <CardHint>{sub}</CardHint>}
    </Panel>
  );
}
