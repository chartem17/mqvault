import { DEFAULT_TIMEZONE, dayKey } from "./timezone";

export function calendarCellKey(date: Date): string {
  if (!Number.isFinite(date.getTime())) throw new RangeError("Invalid calendar date");
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
/** Calendar day of a timestamp in `tz`, or null for an invalid timestamp. */
export function zonedDayOrNull(timestamp: string, tz: string = DEFAULT_TIMEZONE): string | null {
  try { return dayKey(timestamp, tz); } catch { return null; }
}
/** Local-noon Date for the first day of the current month in `tz` (used to drive a month grid). */
export function zonedMonthCursor(tz: string = DEFAULT_TIMEZONE, now = new Date()): Date {
  const [year, month] = dayKey(now, tz).split("-").map(Number);
  return new Date(year, month - 1, 1, 12);
}
function validDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
/** Inclusive calendar-day period check, with the day taken in `tz`. */
export function isInZonedPeriod(timestamp: string, period: { start: string; end: string }, tz: string = DEFAULT_TIMEZONE): boolean {
  if (!validDay(period.start) || !validDay(period.end) || period.start > period.end) return false;
  const day = zonedDayOrNull(timestamp, tz);
  return day !== null && day >= period.start && day <= period.end;
}
/** The last `monthsBack` months up to today in `tz`. */
export function defaultZonedPeriod(monthsBack = 3, now = new Date(), tz: string = DEFAULT_TIMEZONE): { start: string; end: string } {
  if (!Number.isInteger(monthsBack) || monthsBack < 0) throw new RangeError("Invalid monthsBack");
  const end = dayKey(now, tz);
  const [year, month, day] = end.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 - monthsBack, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return { start: target.toISOString().slice(0, 10), end };
}

// Legacy Kyiv-named helpers (kept for compatibility; prefer the zoned versions with the user's zone).
export function kyivDayOrNull(timestamp: string): string | null { return zonedDayOrNull(timestamp, "Europe/Kyiv"); }
export function kyivMonthCursor(now = new Date()): Date { return zonedMonthCursor("Europe/Kyiv", now); }
export function isInKyivPeriod(timestamp: string, period: { start: string; end: string }): boolean { return isInZonedPeriod(timestamp, period, "Europe/Kyiv"); }
export function defaultKyivPeriod(monthsBack = 3, now = new Date()): { start: string; end: string } { return defaultZonedPeriod(monthsBack, now, "Europe/Kyiv"); }
