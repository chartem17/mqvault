"use client";

import { useMemo } from "react";
import { getBrowserTimeZone, getOffsetLabel, getTimeZoneList, shortZoneName } from "@/lib/timezone";
import { Select } from "@/components/ui/primitives";

/** Zones traders use most; shown first. "Etc/GMT-2" means UTC+2 (POSIX sign is inverted). */
const COMMON_ZONES = [
  "UTC",
  "Europe/Kyiv",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Warsaw",
  "America/New_York",
  "America/Chicago",
  "Asia/Dubai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Etc/GMT-2",
  "Etc/GMT-3",
] as const;

export function zoneOptionLabel(tz: string, at = new Date()): string {
  const offset = getOffsetLabel(tz, at);
  if (tz === "UTC" || tz === "Etc/UTC") return "UTC";
  const fixed = /^Etc\/GMT([+-])(\d+)$/.exec(tz);
  if (fixed) return `Фіксований ${offset} (без літнього часу)`;
  return `${shortZoneName(tz)} (${offset})`;
}

/** Native select of IANA time zones; common trading zones first, then the full list. */
export function TimezoneSelect({ value, onChange, disabled, id, "aria-label": ariaLabel, className }: {
  value: string;
  onChange: (zone: string) => void;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  className?: string;
}) {
  const { common, all } = useMemo(() => {
    const now = new Date();
    const browser = getBrowserTimeZone();
    const commonSet = new Set<string>([value, browser, ...COMMON_ZONES].filter(Boolean));
    const common = [...commonSet].map(tz => ({ tz, label: tz === browser && tz !== value ? `${zoneOptionLabel(tz, now)} · браузер` : zoneOptionLabel(tz, now) }));
    const all = getTimeZoneList()
      .filter(tz => !commonSet.has(tz))
      .map(tz => ({ tz, label: `${tz.replace(/_/g, " ")} (${getOffsetLabel(tz, now)})` }));
    return { common, all };
  }, [value]);
  return (
    <Select id={id} aria-label={ariaLabel} value={value} disabled={disabled} onChange={event => onChange(event.target.value)} className={className}>
      <optgroup label="Часто вживані">
        {common.map(({ tz, label }) => <option key={tz} value={tz}>{label}</option>)}
      </optgroup>
      <optgroup label="Усі пояси">
        {all.map(({ tz, label }) => <option key={tz} value={tz}>{label}</option>)}
      </optgroup>
    </Select>
  );
}
