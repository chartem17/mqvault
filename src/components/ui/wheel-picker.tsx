"use client";

import "@ncdai/react-wheel-picker/style.css";
import {
  WheelPicker as BaseWheelPicker,
  WheelPickerWrapper as BaseWheelPickerWrapper,
  type WheelPickerOption,
  type WheelPickerProps,
  type WheelPickerValue,
} from "@ncdai/react-wheel-picker";
import { cn } from "@/lib/utils";

export type { WheelPickerOption };

/** Frame around one or more wheels (iOS-style picker). */
export function WheelPickerWrapper({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <BaseWheelPickerWrapper className={cn("rounded-xl border border-border bg-background px-1", className)}>
      {children}
    </BaseWheelPickerWrapper>
  );
}

/** One scrollable wheel: drag, mouse wheel, arrow keys and type-ahead. */
export function WheelPicker<T extends WheelPickerValue>({ classNames, ...props }: WheelPickerProps<T>) {
  return (
    <BaseWheelPicker<T>
      optionItemHeight={32}
      visibleCount={20}
      {...props}
      classNames={{
        optionItem: cn("text-muted-foreground/70 tabular-nums", classNames?.optionItem),
        highlightWrapper: cn("rounded-lg bg-secondary text-foreground", classNames?.highlightWrapper),
        highlightItem: cn("font-semibold tabular-nums", classNames?.highlightItem),
      }}
    />
  );
}
