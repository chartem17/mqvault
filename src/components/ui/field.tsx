"use client";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./field.css";

export type FieldControlProps = { id: string; "aria-describedby"?: string; "aria-invalid": boolean; "data-ui-state"?: "error" | "warning" };
export function Field({ label, error, warning, hint, className, children }: { label: string; error?: ReactNode; warning?: ReactNode; hint?: ReactNode; className?: string; children: (props: FieldControlProps) => ReactNode }) {
  const id = useId();
  const invalid = Boolean(error);
  const message = error || warning || hint;
  return <div className={cn("flex min-w-0 flex-col gap-1", className)}><label htmlFor={id} className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>{children({ id, "aria-describedby": message ? `${id}-message` : undefined, "aria-invalid": invalid, "data-ui-state": invalid ? "error" : warning ? "warning" : undefined })}{message && <span id={`${id}-message`} className={cn("text-[11px]", invalid ? "text-destructive" : warning ? "text-gold" : "text-muted-foreground")}>{message}</span>}</div>;
}
