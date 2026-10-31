import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({ title, description, action, className, role }: { title: string; description?: ReactNode; action?: ReactNode; className?: string; role?: "status" | "alert" }) {
  return <div role={role} className={cn("text-center text-sm text-muted-foreground", className)}><p>{title}</p>{description && <div className="mt-1 text-xs">{description}</div>}{action && <div className="mt-3 flex justify-center">{action}</div>}</div>;
}
