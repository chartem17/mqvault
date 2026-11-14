"use client";

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, getDefaultClassNames, type DayPickerProps } from "react-day-picker";
import { enGB, uk } from "react-day-picker/locale";
import { useI18n } from "@/components/providers/i18n-provider";
import { usePreferences } from "@/components/providers/preferences-provider";
import { cn } from "@/lib/utils";

const NAV_BUTTON =
  "inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring aria-disabled:pointer-events-none aria-disabled:opacity-40";

/**
 * Month grid (react-day-picker, shadcn-style). Language follows the app locale,
 * the first weekday follows the user's "week starts on" preference.
 */
export function Calendar({ className, classNames, showOutsideDays = true, captionLayout = "label", ...props }: DayPickerProps) {
  const { locale } = useI18n();
  const { preferences } = usePreferences();
  const base = getDefaultClassNames();
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      locale={locale === "uk" ? uk : enGB}
      weekStartsOn={preferences.weekStart}
      className={cn("p-3 [--cell:2.25rem]", className)}
      classNames={{
        root: cn("w-fit", base.root),
        months: cn("relative flex flex-col gap-4 sm:flex-row", base.months),
        month: cn("flex w-full flex-col gap-3", base.month),
        nav: cn("absolute inset-x-0 top-0 flex w-full items-center justify-between", base.nav),
        button_previous: cn(NAV_BUTTON, base.button_previous),
        button_next: cn(NAV_BUTTON, base.button_next),
        month_caption: cn("flex h-8 w-full items-center justify-center px-8", base.month_caption),
        dropdowns: cn("flex h-8 w-full items-center justify-center gap-1.5 text-sm font-medium", base.dropdowns),
        dropdown_root: cn("relative rounded-lg border border-input has-focus:outline has-focus:outline-2 has-focus:outline-ring", base.dropdown_root),
        dropdown: cn("absolute inset-0 cursor-pointer bg-popover opacity-0", base.dropdown),
        caption_label: cn(
          "select-none text-sm font-medium capitalize",
          captionLayout !== "label" && "flex h-8 items-center gap-1 rounded-lg pl-2 pr-1 [&>svg]:size-3.5 [&>svg]:text-muted-foreground",
          base.caption_label,
        ),
        month_grid: "w-full border-collapse",
        weekdays: cn("flex", base.weekdays),
        weekday: cn("flex-1 select-none text-[0.75rem] font-normal capitalize text-muted-foreground", base.weekday),
        week: cn("mt-1 flex w-full", base.week),
        day: cn("group/day relative size-(--cell) p-0 text-center text-sm", base.day),
        day_button: cn(
          "inline-flex size-(--cell) items-center justify-center rounded-lg tabular-nums transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
          "group-data-[selected=true]/day:bg-primary group-data-[selected=true]/day:font-semibold group-data-[selected=true]/day:text-primary-foreground group-data-[selected=true]/day:hover:opacity-90",
          base.day_button,
        ),
        today: cn("[&>button]:ring-1 [&>button]:ring-inset [&>button]:ring-primary/50 [&>button]:font-semibold", base.today),
        outside: cn("text-muted-foreground/50", base.outside),
        disabled: cn("pointer-events-none text-muted-foreground opacity-40", base.disabled),
        hidden: cn("invisible", base.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClass }) => {
          const Icon = orientation === "left" ? ChevronLeft : orientation === "right" ? ChevronRight : ChevronDown;
          return <Icon className={cn("size-4", chevronClass)} aria-hidden="true" />;
        },
      }}
      {...props}
    />
  );
}
