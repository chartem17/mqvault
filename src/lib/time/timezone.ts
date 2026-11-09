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

/**
 * Broker server clock that is not in the IANA database: New York time + 7 hours, i.e. GMT+2 in winter and GMT+3
 * in summer with the United States DST dates (ADR 0016, §9.3 of features/mt5-bridge.md). Most MT5 forex brokers
 * run on it so that the daily candle closes at 17:00 New York. Europe/Kyiv differs from it for ~4 weeks a year.
 */
export const FX_NY7_ZONE = "FX/NewYork+7";
const NEW_YORK = "America/New_York";

const offsetFormatters = new Map<string, Intl.DateTimeFormat>();
/** Offset of an IANA zone from UTC at an instant, in milliseconds. */
function ianaOffsetMs(ms: number, tz: string): number {
  let formatter = offsetFormatters.get(tz);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
    offsetFormatters.set(tz, formatter);
  }
  const p = Object.fromEntries(formatter.formatToParts(new Date(ms)).map(part => [part.type, part.value]));
  const wall = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return wall - Math.floor(ms / 1000) * 1000;
}

/** Offset of `tz` (IANA or FX_NY7_ZONE) from UTC at an instant, in minutes. */
export function zoneOffsetMinutes(input: number | Date, tz: string): number {
  const ms = input instanceof Date ? input.getTime() : input;
  if (tz === FX_NY7_ZONE) return Math.round(ianaOffsetMs(ms, NEW_YORK) / 60_000) + 7 * 60;
  return Math.round(ianaOffsetMs(ms, tz) / 60_000);
}

/**
 * Intl cannot format FX_NY7_ZONE: for it, returns the instant shifted to its wall clock and "UTC" as the zone,
 * so `new Intl.DateTimeFormat(locale, { timeZone }).format(date)` shows the broker wall time. IANA zones pass through.
 */
export function intlInstant(input: number | Date, tz: string): { date: Date; timeZone: string } {
  const date = input instanceof Date ? input : new Date(input);
  if (tz !== FX_NY7_ZONE) return { date, timeZone: tz };
  return { date: new Date(date.getTime() + zoneOffsetMinutes(date, tz) * 60_000), timeZone: "UTC" };
}

export function isValidTimeZone(tz: string): boolean {
  if (typeof tz !== "string" || !tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** IANA zone or FX_NY7_ZONE: allowed for an account's broker clock, never for the user's own zone. */
export function isValidBrokerTimeZone(tz: string): boolean {
  return tz === FX_NY7_ZONE || isValidTimeZone(tz);
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
  if (tz === FX_NY7_ZONE) return `GMT+${zoneOffsetMinutes(date, tz) / 60}`;
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
  if (tz === FX_NY7_ZONE) return "New York +7";
  const last = tz.split("/").pop() ?? tz;
  return last.replace(/_/g, " ");
}

const partFormatters = new Map<string, Intl.DateTimeFormat>();
/** Calendar date and wall-clock time of an instant in `tz`. Throws RangeError on invalid input or zone. */
export function zonedParts(input: string | number | Date, tz: string) {
  const raw = input instanceof Date ? input : new Date(input);
  if (!Number.isFinite(raw.getTime())) throw new RangeError("Invalid timestamp");
  const { date, timeZone } = intlInstant(raw, tz);
  tz = timeZone;
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

/** Monday 00:00 → next Monday 00:00 of the week containing `now`, in `tz`, as UTC ms. */
export function zonedWeekRange(now: number | Date, tz: string): { from: number; to: number } {
  const today = dayKey(now, tz);
  const weekday = new Date(`${today}T00:00:00.000Z`).getUTCDay();
  const monday = shiftDay(today, -((weekday + 6) % 7));
  return { from: zonedWallTime(monday, "00:00", tz), to: zonedWallTime(shiftDay(monday, 7), "00:00", tz) };
}

/** Start of a calendar day in `tz` as UTC ms; null for an empty/invalid day. */
export function startOfZonedDay(day: string | null | undefined, tz: string): number | null {
  if (!day || !validDay(day.trim())) return null;
  return zonedWallTime(day.trim(), "00:00", tz);
}

export function formatDateTime(
  iso: string,
  tz: string,
  locale = "en-GB",
): string {
  const { date, timeZone } = intlInstant(new Date(iso), tz);
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
export function formatDateTimeOrDash(iso: string | null | undefined, tz: string, locale = "en-GB"): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "—";
  try { return formatDateTime(iso, tz, locale); } catch { return "—"; }
}
