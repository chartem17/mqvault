"use client";

import { useMemo, useRef, useState } from "react";
import { CalendarDays, Clock, X } from "lucide-react";
import { Dialog, Modal, ModalOverlay, Popover } from "react-aria-components";
import { Calendar } from "./calendar";
import { WheelPicker, WheelPickerWrapper, type WheelPickerOption } from "./wheel-picker";
import { Button } from "./primitives";
import { DIALOG_BACKDROP } from "./dialog-styles";
import { useI18n } from "@/components/providers/i18n-provider";
import { useTimezone } from "@/components/providers/timezone-provider";
import { cn } from "@/lib/utils";
import { PHONE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { toZonedInputValue } from "@/lib/time/timezone";
import {
  dayToGridDate, formatPickerDay, gridDateToDay, joinDateTime, joinTime, splitDateTime, splitTime,
} from "@/lib/time/picker-value";

export type DateTimeFieldType = "date" | "time" | "datetime-local";

export type DateTimeFieldProps = {
  /** Same value formats as the native inputs: "YYYY-MM-DD", "HH:mm", "YYYY-MM-DDTHH:mm". */
  type?: DateTimeFieldType;
  value: string;
  onChange: (value: string) => void;
  /** Zone that "today" / "now" are taken in. Defaults to the user's zone. */
  zone?: string;
  /** Show a clear (×) button when a value is set. */
  clearable?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "data-ui-state"?: "error" | "warning";
  /** Lets forms focus the field by name (e.g. the first invalid one). */
  "data-trade-field"?: string;
};

const HOURS: WheelPickerOption<number>[] = Array.from({ length: 24 }, (_, hour) => ({ value: hour, label: String(hour).padStart(2, "0") }));
const MINUTES: WheelPickerOption<number>[] = Array.from({ length: 60 }, (_, minute) => ({ value: minute, label: String(minute).padStart(2, "0") }));

const TRIGGER =
  "flex w-full min-h-10 items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-left text-sm text-foreground transition-colors hover:border-ring/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive data-[open=true]:border-ring";

/** The picker opens in a popover attached to <body>: "click outside" handlers of panels that host a field should ignore it. */
export function isInPickerPopover(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("[data-picker-popover]"));
}

/**
 * Date, time or date + time field: a button that opens a calendar and/or time wheels in a popover.
 * Replaces the browser's native pickers, which look different in every browser and can't be themed.
 */
export function DateTimeField({
  type = "date", value, onChange, zone, clearable = false, placeholder, disabled, className, ...rest
}: DateTimeFieldProps) {
  const { t, intl } = useI18n();
  const { timezone } = useTimezone();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const nowZone = zone ?? timezone;
  const phone = useMediaQuery(PHONE_QUERY);

  const withDate = type !== "time";
  const withTime = type !== "date";
  const parts = type === "datetime-local" ? splitDateTime(value) : type === "date" ? { day: splitDateTime(`${value}T00:00`).day, time: "" } : { day: "", time: splitTime(value) ? value : "" };

  const label = useMemo(() => {
    const day = parts.day ? formatPickerDay(parts.day, intl) : "";
    if (type === "date") return day;
    if (type === "time") return parts.time;
    return day ? `${day}, ${parts.time || "00:00"}` : "";
  }, [type, parts.day, parts.time, intl]);

  const Icon = withDate ? CalendarDays : Clock;
  const fallbackPlaceholder = type === "time" ? t("Pick a time") : type === "date" ? t("Pick a date") : t("Pick date and time");

  function now() { return toZonedInputValue(new Date().toISOString(), nowZone); }
  function emit(day: string, time: string) {
    if (type === "date") onChange(day);
    else if (type === "time") onChange(time);
    else onChange(joinDateTime(day, time));
  }
  function pickDay(date: Date | undefined) {
    if (!date) return;
    const day = gridDateToDay(date);
    emit(day, parts.time || (type === "datetime-local" ? now().slice(11, 16) : ""));
    if (type === "date") setOpen(false);
  }
  function pickTime(hour: number, minute: number) {
    emit(parts.day || now().slice(0, 10), joinTime(hour, minute));
  }
  function setNow() {
    const current = now();
    emit(current.slice(0, 10), current.slice(11, 16));
    if (type === "date") setOpen(false);
  }

  const time = splitTime(parts.time) ?? { hour: 0, minute: 0 };
  const today = dayToGridDate(now().slice(0, 10));
  const selected = dayToGridDate(parts.day);

  return (
    <div className={cn("relative min-w-0", className)}>
      <button
        {...rest}
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-open={open || undefined}
        onClick={() => setOpen(current => !current)}
        className={cn(TRIGGER, "ui-field-control", clearable && value && "pr-9")}
      >
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className={cn("min-w-0 flex-1 truncate tabular-nums", !label && "text-muted-foreground")}>{label || placeholder || fallbackPlaceholder}</span>
      </button>
      {clearable && value && !disabled ? (
        <button type="button" onClick={() => onChange("")} aria-label={t("Clear")} className="absolute right-2 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
          <X className="size-3.5" aria-hidden="true" />
        </button>
      ) : null}

      {phone ? (
        // Phone: a bottom sheet, so the calendar and wheels are never cut off by the screen edge.
        <ModalOverlay isOpen={open} onOpenChange={setOpen} isDismissable className={`fixed inset-0 z-[70] flex items-end ${DIALOG_BACKDROP}`}>
          <Modal className="max-h-[92dvh] w-full overflow-auto rounded-t-2xl border border-b-0 border-border bg-popover pb-[env(safe-area-inset-bottom)] text-popover-foreground shadow-2xl outline-none data-[entering]:animate-[ui-sheet-in_0.24s_cubic-bezier(0.22,1,0.36,1)] [&_.rdp-root]:mx-auto">
        <Dialog aria-label={rest["aria-label"] ?? fallbackPlaceholder} className="outline-none">
          <div data-picker-popover="">
          <div className="flex flex-col sm:flex-row">
            {withDate ? (
              <Calendar
                mode="single"
                selected={selected}
                onSelect={pickDay}
                defaultMonth={selected ?? today}
                today={today}
                autoFocus
              />
            ) : null}
            {withTime ? (
              <div className={cn("flex flex-col justify-center gap-2 p-3", withDate && "border-t border-border sm:border-l sm:border-t-0")}>
                <div className="grid grid-cols-2 gap-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>{t("Hours")}</span><span>{t("Minutes")}</span>
                </div>
                <WheelPickerWrapper className={cn("w-full", withDate ? "sm:w-44" : "sm:w-52")}>
                  <WheelPicker<number> options={HOURS} value={time.hour} onValueChange={hour => pickTime(hour, time.minute)} infinite />
                  <WheelPicker<number> options={MINUTES} value={time.minute} onValueChange={minute => pickTime(time.hour, minute)} infinite />
                </WheelPickerWrapper>
              </div>
            ) : null}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
            <Button variant="ghost" size="sm" onClick={setNow}>{type === "date" ? t("Today") : t("Now")}</Button>
            {type === "date" ? null : <Button size="sm" onClick={() => { setOpen(false); triggerRef.current?.focus(); }}>{t("Done")}</Button>}
          </div>
          </div>
        </Dialog>
          </Modal>
        </ModalOverlay>
      ) : (
        <Popover
        triggerRef={triggerRef}
        isOpen={open}
        onOpenChange={setOpen}
        placement="bottom start"
        offset={6}
        className="z-[70] max-w-[calc(100vw-1rem)] overflow-auto rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl outline-none data-[entering]:animate-[ui-pop-in_0.18s_cubic-bezier(0.22,1,0.36,1)]"
      >
        <Dialog aria-label={rest["aria-label"] ?? fallbackPlaceholder} className="outline-none">
          <div data-picker-popover="">
          <div className="flex flex-col sm:flex-row">
            {withDate ? (
              <Calendar
                mode="single"
                selected={selected}
                onSelect={pickDay}
                defaultMonth={selected ?? today}
                today={today}
                autoFocus
              />
            ) : null}
            {withTime ? (
              <div className={cn("flex flex-col justify-center gap-2 p-3", withDate && "border-t border-border sm:border-l sm:border-t-0")}>
                <div className="grid grid-cols-2 gap-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>{t("Hours")}</span><span>{t("Minutes")}</span>
                </div>
                <WheelPickerWrapper className={cn("w-full", withDate ? "sm:w-44" : "sm:w-52")}>
                  <WheelPicker<number> options={HOURS} value={time.hour} onValueChange={hour => pickTime(hour, time.minute)} infinite />
                  <WheelPicker<number> options={MINUTES} value={time.minute} onValueChange={minute => pickTime(time.hour, minute)} infinite />
                </WheelPickerWrapper>
              </div>
            ) : null}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
            <Button variant="ghost" size="sm" onClick={setNow}>{type === "date" ? t("Today") : t("Now")}</Button>
            {type === "date" ? null : <Button size="sm" onClick={() => { setOpen(false); triggerRef.current?.focus(); }}>{t("Done")}</Button>}
          </div>
          </div>
        </Dialog>
        </Popover>
      )}
    </div>
  );
}
