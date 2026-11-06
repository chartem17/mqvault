"use client";

import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { useTimezone } from "@/components/providers/timezone-provider";
import { TimezoneSelect, zoneOptionLabel } from "@/components/settings/timezone-select";
import { Button } from "@/components/ui/primitives";

/** Header control: shows the user's display zone and lets them change it (saved to their profile). */
export function TimezoneControl() {
  const { timezone, saved, loading, saving, error, setTimezone } = useTimezone();
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
  const label = zoneOptionLabel(timezone);
  return (
    <div className="relative" ref={ref}>
      <Button variant="secondary" aria-expanded={open} aria-label={`Часовий пояс: ${label}`} title="Часовий пояс" onClick={() => setOpen(value => !value)}>
        <Clock aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span className="hidden xl:inline">{label}</span>
      </Button>
      {open && (
        <section aria-label="Часовий пояс" className="fixed inset-x-3 top-16 z-40 space-y-3 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[340px] rounded-2xl border border-border bg-card p-4 shadow-2xl">
          <div>
            <p className="text-sm font-medium">Ваш часовий пояс</p>
            <p className="mt-1 text-xs text-muted-foreground">У ньому показується час угод, рахуються дні календаря, денний і місячний P&amp;L та періоди Strategy Control. Сесії (Asia, London, New York) прив&apos;язані до часу самих ринків і від поясу не змінюються.</p>
          </div>
          <TimezoneSelect aria-label="Часовий пояс" value={timezone} disabled={loading || saving} onChange={zone => { void setTimezone(zone); }} />
          <p role="status" className="text-xs text-muted-foreground">
            {loading ? "Завантаження…" : saving ? "Збереження…" : saved ? "Збережено у профілі." : "Зараз використовується пояс браузера. Оберіть пояс, щоб зберегти його."}
          </p>
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        </section>
      )}
    </div>
  );
}
