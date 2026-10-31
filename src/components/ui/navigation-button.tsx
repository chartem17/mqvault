"use client";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Button } from "./primitives";

export type NavigationButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style"> & { active?: boolean; icon?: ReactNode };
export function NavigationButton({ active = false, icon, children, className, ...props }: NavigationButtonProps) {
  return <Button {...props} variant="ghost" aria-current={active ? "page" : undefined} data-active={active || undefined} className={className} style={{ width: "100%", justifyContent: "flex-start", gap: "0.75rem", padding: "0.625rem 0.75rem", fontSize: "0.875rem", fontWeight: 400, ...(active ? { backgroundColor: "var(--color-accent)", color: "var(--color-foreground)" } : { color: "var(--color-muted-foreground)" }) }}>{icon}<span className="truncate">{children}</span></Button>;
}
