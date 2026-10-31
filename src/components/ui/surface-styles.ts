import { cn } from "@/lib/utils";

export const SURFACE_BASE = "min-w-0 rounded-2xl border border-border bg-card text-card-foreground";
export function surfaceClass(...classes: (string | undefined | false)[]) {
  return cn(SURFACE_BASE, ...classes);
}
