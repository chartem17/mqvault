import type { ReactNode } from "react";
import { CARD_SURFACE, CARD_TITLE } from "@/components/ui/overview-styles";

/** Shared frame of every Overview widget: fills its grid cell, the body scrolls instead of growing. */
export function WidgetPanel({ title, sub, aside, children, scroll = false, className = "", bodyClassName = "" }: { title: string; sub?: ReactNode; aside?: ReactNode; children: ReactNode; scroll?: boolean; className?: string; bodyClassName?: string }) {
  return <section className={`${CARD_SURFACE} relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-5 ${className}`}>
    <header className="relative z-10 mb-4 flex shrink-0 items-start justify-between gap-3"><div className="min-w-0"><h3 className={`${CARD_TITLE} m-0 truncate`}>{title}</h3>{sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}</div>{aside}</header>
    <div className={`relative z-10 min-h-0 flex-1 ${scroll ? "overflow-auto overscroll-contain pr-2 [scrollbar-gutter:stable] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" : ""} ${bodyClassName}`} {...(scroll ? { tabIndex: 0, role: "region", "aria-label": title } : {})}>{children}</div>
  </section>;
}
