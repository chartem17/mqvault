"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const control = "w-full min-h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  value: string;
  /** Full text of the best suggestion; the part beyond `value` is drawn as a ghost. */
  suggestion?: string | null;
  /** Called when the user accepts the ghost with Tab or →. */
  onAccept?: (suggestion: string) => void;
};

/** Input with inline "ghost" autocompletion: the remainder of the best match is shown in muted text after the caret. */
export const GhostInput = forwardRef<HTMLInputElement, Props>(function GhostInput({ value, suggestion, onAccept, className, onKeyDown, ...props }, ref) {
  const ghost = suggestion && value && suggestion.toLowerCase().startsWith(value.toLowerCase()) && suggestion.length > value.length ? suggestion : null;
  return <div className="relative">
    {ghost && <div aria-hidden="true" className={cn(control, "pointer-events-none absolute inset-0 flex items-center border-transparent bg-transparent")}>
      <span className="invisible whitespace-pre">{value}</span><span className="truncate text-muted-foreground/70">{ghost.slice(value.length)}</span>
    </div>}
    <input {...props} ref={ref} value={value} autoComplete="off" autoCapitalize="off" spellCheck={false}
      className={cn(control, "relative bg-transparent", className)}
      onKeyDown={event => {
        if (ghost && (event.key === "Tab" || (event.key === "ArrowRight" && event.currentTarget.selectionStart === value.length))) {
          event.preventDefault();
          onAccept?.(ghost);
        }
        onKeyDown?.(event);
      }} />
  </div>;
});
