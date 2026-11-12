"use client";

import type { ReactNode } from "react";
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@ui-sdk/react/segmented-control";
import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = { value: T; label: ReactNode; icon?: ReactNode; disabled?: boolean };

/**
 * One choice out of a few, all visible, with a pill that glides to the checked item.
 * `tone="primary"` fills the pill with the accent colour; `"panel"` keeps it quiet.
 */
export function Segmented<T extends string>({ value, onChange, options, className, size = "sm", tone = "primary", disabled, wrap = false, ...aria }: {
  value: T | null; onChange: (value: T) => void; options: readonly SegmentedOption<T>[]; className?: string;
  size?: "xs" | "sm" | "md"; tone?: "primary" | "panel"; disabled?: boolean; wrap?: boolean;
  "aria-label"?: string; "aria-labelledby"?: string;
}) {
  return <SegmentedControl value={value} onValueChange={next => { if (next !== null) onChange(next as T); }} disabled={disabled} loop
    data-size={size} data-tone={tone} data-wrap={wrap || undefined} className={cn("mq-segmented", className)} {...aria}>
    {!wrap && <SegmentedControlIndicator className="mq-segmented-pill" />}
    {options.map(option => <SegmentedControlItem key={option.value} value={option.value} disabled={option.disabled} className="mq-segmented-item">
      {option.icon}{option.label}
    </SegmentedControlItem>)}
  </SegmentedControl>;
}
