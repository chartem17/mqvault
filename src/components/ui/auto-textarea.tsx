"use client";

import { forwardRef, useCallback, type TextareaHTMLAttributes } from "react";
import { Textarea } from "./primitives";

/** Textarea that grows with its content, line by line, up to `maxRows`. */
export const AutoTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { maxRows?: number }>(
  function AutoTextarea({ maxRows = 12, rows = 2, onChange, className, ...props }, outerRef) {
    const fit = useCallback((element: HTMLTextAreaElement | null) => {
      if (!element) return;
      const lineHeight = parseFloat(getComputedStyle(element).lineHeight) || 20;
      element.style.height = "auto";
      const extra = element.offsetHeight - element.clientHeight + (element.clientHeight - element.scrollHeight < 0 ? 0 : 0);
      element.style.height = `${Math.min(element.scrollHeight + extra, lineHeight * maxRows + (element.offsetHeight - element.clientHeight))}px`;
      element.style.overflowY = element.scrollHeight > lineHeight * maxRows ? "auto" : "hidden";
    }, [maxRows]);
    const ref = useCallback((element: HTMLTextAreaElement | null) => {
      fit(element);
      if (typeof outerRef === "function") outerRef(element);
      else if (outerRef) outerRef.current = element;
    }, [fit, outerRef]);
    return <Textarea {...props} rows={rows} ref={ref} className={`min-h-0 resize-none ${className ?? ""}`}
      onChange={event => { fit(event.currentTarget); onChange?.(event); }} />;
  });
