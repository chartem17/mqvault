"use client";

import type { ReactElement, ReactNode } from "react";
import { Tooltip, TooltipArrow, TooltipContent, TooltipShortcut, TooltipTrigger } from "@ui-sdk/react/tooltip";

type Side = "top" | "bottom" | "left" | "right";

/**
 * A short hint on hover and keyboard focus, in place of the native `title`. The child keeps its own
 * element and classes (it must be focusable, like a button or link, and forward its ref).
 */
export function Hint({ label, children, side = "top", shortcut, disabled }: { label: ReactNode; children: ReactElement<Record<string, unknown>>; side?: Side; shortcut?: string; disabled?: boolean }) {
  return <Tooltip delay={350} closeDelay={60} shortcut={shortcut} disabled={disabled}>
    <TooltipTrigger render={children} className="mq-hint" />
    <TooltipContent side={side} sideOffset={8} collisionPadding={8} className="mq-tooltip">
      <TooltipArrow className="mq-tooltip-arrow" />
      {label}
      {shortcut && <TooltipShortcut className="mq-tooltip-keys" />}
    </TooltipContent>
  </Tooltip>;
}
