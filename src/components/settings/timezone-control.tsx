"use client";

import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { useTimezone } from "@/components/providers/timezone-provider";
import { TimezoneSelect, zoneOptionLabel } from "@/components/settings/timezone-select";
import { Button } from "@/components/ui/primitives";
import { useI18n } from "@/components/providers/i18n-provider";

/** Header control: shows the user's display zone and lets them change it (saved to their profile). */
export function TimezoneControl() {
  const { timezone, saved, loading, saving, error, setTimezone } = useTimezone();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); }
    function onKeyDown(event: KeyboardEvent) { if (event.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("mousedown", onPointerDown); document.removeEventListener("keydown", onKeyDown); };
  }, [open]);
  const label = zoneOptionLabel(timezone, undefined, t);
  return (
    <div className="relative" ref={ref}>
      <Button variant="secondary" className="px-2.5 sm:px-4" aria-expanded={open} aria-label={t("Time zone: {zone}", { zone: label })} title={t("Time zone")} onClick={() => setOpen(value => !value)}>
        <Clock aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span className="hidden xl:inline">{label}</span>
      </Button>
      {open && (
        <section aria-label={t("Time zone")} className="fixed inset-x-3 top-16 z-40 space-y-3 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[340px] rounded-2xl border border-border bg-card p-4 shadow-2xl">
          <div>
            <p className="text-sm font-medium">{t("Your time zone")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("Trade times, calendar days, daily and monthly P&L and Strategy Control periods use this zone. Sessions (Asia, London, New York) follow the markets' own clocks and do not change with it.")}</p>
          </div>
          <TimezoneSelect aria-label={t("Time zone")} value={timezone} disabled={loading || saving} onChange={zone => { void setTimezone(zone); }} />
          <p role="status" className="text-xs text-muted-foreground">
            {loading ? t("Loading…") : saving ? t("Saving…") : saved ? t("Saved to your profile.") : t("Using your browser's time zone. Pick one to save it.")}
          </p>
          {error && <p role="alert" className="text-xs text-destructive">{t(error)}</p>}
        </section>
      )}
    </div>
  );
}
