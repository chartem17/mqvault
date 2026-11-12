"use client";

import { useMemo } from "react";
import { FX_NY7_ZONE, getBrowserTimeZone, getOffsetLabel, getTimeZoneList, shortZoneName } from "@/lib/time/timezone";
import { Select } from "@/components/ui/primitives";
import { useI18n } from "@/components/providers/i18n-provider";
import { translate, type Vars } from "@/lib/i18n/core";

type T = (text: string, vars?: Vars) => string;
const identity: T = (text, vars) => translate(null, text, vars);

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

export function zoneOptionLabel(tz: string, at = new Date(), t: T = identity): string {
  const offset = getOffsetLabel(tz, at);
  if (tz === "UTC" || tz === "Etc/UTC") return "UTC";
  if (tz === FX_NY7_ZONE) return t("MT5 server: New York +7 ({offset})", { offset });
  const fixed = /^Etc\/GMT([+-])(\d+)$/.exec(tz);
  if (fixed) return t("Fixed {offset} (no DST)", { offset });
  return `${shortZoneName(tz)} (${offset})`;
}

/**
 * Native select of IANA time zones; common trading zones first, then the full list.
 * `broker` adds the MT5 "New York + 7" server clock, which is valid for an account but not for the user's own zone.
 */
export function TimezoneSelect({ value, onChange, disabled, id, "aria-label": ariaLabel, className, broker = false }: {
  value: string;
  broker?: boolean;
  onChange: (zone: string) => void;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const { common, all } = useMemo(() => {
    const now = new Date();
    const browser = getBrowserTimeZone();
    const commonSet = new Set<string>([value, browser, ...(broker ? [FX_NY7_ZONE] : []), ...COMMON_ZONES].filter(Boolean));
    const common = [...commonSet].map(tz => ({ tz, label: tz === browser && tz !== value ? t("{zone} · browser", { zone: zoneOptionLabel(tz, now, t) }) : zoneOptionLabel(tz, now, t) }));
    const all = getTimeZoneList()
      .filter(tz => !commonSet.has(tz))
      .map(tz => ({ tz, label: `${tz.replace(/_/g, " ")} (${getOffsetLabel(tz, now)})` }));
    return { common, all };
  }, [value, t, broker]);
  return (
    <Select id={id} aria-label={ariaLabel} value={value} disabled={disabled} onChange={event => onChange(event.target.value)} className={className} search={{ label: t("Search time zones"), placeholder: t("Search time zones…"), empty: t("Nothing found") }}>
      <optgroup label={t("Common")}>
        {common.map(({ tz, label }) => <option key={tz} value={tz}>{label}</option>)}
      </optgroup>
      <optgroup label={t("All time zones")}>
        {all.map(({ tz, label }) => <option key={tz} value={tz}>{label}</option>)}
      </optgroup>
    </Select>
  );
}
