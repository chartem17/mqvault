/**
 * Time zone helpers.
 *
 * Storage rule: every timestamp in the database is an absolute instant
 * (Postgres timestamptz, i.e. UTC). A time zone is only applied when
 * converting to/from what a person sees or types:
 *  - display, day/month bucketing and statistics use the user's zone;
 *  - manually typed trade times are read in the account's broker zone.
 */
export const DEFAULT_TIMEZONE = "Europe/Kyiv";

export function isValidTimeZone(tz: string): boolean {
  if (typeof tz !== "string" || !tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function getBrowserTimeZone(): string {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isValidTimeZone(tz) ? tz : DEFAULT_TIMEZONE;
}

export function getTimeZoneList(): string[] {
  const intl = Intl as typeof Intl & {
    supportedValuesOf?: (key: "timeZone") => string[];
  };
  const list = intl.supportedValuesOf?.("timeZone");
  return list?.length ? list : [DEFAULT_TIMEZONE, "UTC"];
}

export function getOffsetLabel(tz: string, date = new Date()): string {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "shortOffset",
  })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? "";
}

/** "Europe/Kyiv" → "Kyiv", "America/New_York" → "New York". */
export function shortZoneName(tz: string): string {
  const last = tz.split("/").pop() ?? tz;
  return last.replace(/_/g, " ");
}

const partFormatters = new Map<string, Intl.DateTimeFormat>();
/** Calendar date and wall-clock time of an instant in `tz`. Throws RangeError on invalid input or zone. */
export function zonedParts(input: string | number | Date, tz: string) {
  const date = input instanceof Date ? input : new Date(input);
  if (!Number.isFinite(date.getTime())) throw new RangeError("Invalid timestamp");
  let formatter = partFormatters.get(tz);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    partFormatters.set(tz, formatter);
  }
  const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
  return { date: `${parts.year.padStart(4, "0")}-${parts.month}-${parts.day}`, hour: Number(parts.hour), minute: Number(parts.minute) };
}

function validDay(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const date = new Date(`${day}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day;
}
export function shiftDay(day: string, difference: number): string {
  if (!validDay(day)) throw new RangeError("Invalid calendar date");
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + difference);
  return date.toISOString().slice(0, 10);
}

/**
 * UTC instant (ms) of wall-clock `time` (HH:mm) on calendar `day` in `zone`.
 * In a spring-forward gap the instant just after the gap is returned.
 */
export function zonedWallTime(day: string, time: string, zone: string): number {
  if (!validDay(day) || !/^\d{2}:\d{2}$/.test(time)) throw new RangeError("Invalid wall time");
  const target = Date.parse(`${day}T${time}:00.000Z`);
  let candidate = target;
  for (let attempt = 0; attempt < 6; attempt++) {
    const parts = zonedParts(candidate, zone);
    const wall = Date.parse(`${parts.date}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}:00.000Z`);
    if (wall === target) return candidate;
    candidate += target - wall;
  }
  // Non-existent local time (DST gap): resolve to the first valid minute after it.
  const probe = target - 4 * 3600_000;
  for (let t = probe; t < probe + 8 * 3600_000; t += 60_000) {
    const parts = zonedParts(t, zone);
    const wall = Date.parse(`${parts.date}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}:00.000Z`);
    if (wall > target) return t;
  }
  throw new RangeError(`Wall time ${day} ${time} cannot be resolved in ${zone}`);
}

/** Day key "YYYY-MM-DD" of an instant in `tz`. */
export function dayKey(iso: string | number | Date, tz: string): string {
  return zonedParts(iso, tz).date;
}
export function dayKeyOrNull(iso: string | null | undefined, tz: string): string | null {
  if (!iso) return null;
  try { return dayKey(iso, tz); } catch { return null; }
}
/** Month key "YYYY-MM" of an instant in `tz`. */
export function monthKey(iso: string | number | Date, tz: string): string {
  return dayKey(iso, tz).slice(0, 7);
}
/** "HH:mm" of an instant in `tz`. */
export function timeLabel(iso: string | number | Date, tz: string): string {
  const { hour, minute } = zonedParts(iso, tz);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Instant → value for <input type="datetime-local"> as seen in `tz` ("YYYY-MM-DDTHH:mm"). */
export function toZonedInputValue(iso: string | null | undefined, tz: string): string {
  if (!iso) return "";
  try { return `${dayKey(iso, tz)}T${timeLabel(iso, tz)}`; } catch { return ""; }
}
/** <input type="datetime-local"> value typed in `tz` → ISO instant (UTC). Empty string for empty/invalid input. */
export function fromZonedInputValue(value: string | null | undefined, tz: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec((value ?? "").trim());
  if (!match) return "";
  try { return new Date(zonedWallTime(match[1], match[2], tz)).toISOString(); } catch { return ""; }
}

/** Start of a calendar day in `tz` as UTC ms; null for an empty/invalid day. */
export function startOfZonedDay(day: string | null | undefined, tz: string): number | null {
  if (!day || !validDay(day.trim())) return null;
  return zonedWallTime(day.trim(), "00:00", tz);
}

export function formatDateTime(
  iso: string,
  tz: string,
  locale = "uk-UA",
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: tz,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}
export function formatDateTimeOrDash(iso: string | null | undefined, tz: string, locale = "uk-UA"): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "—";
  try { return formatDateTime(iso, tz, locale); } catch { return "—"; }
}
