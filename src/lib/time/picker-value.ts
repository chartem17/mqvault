// Value helpers for the date / time pickers. Values keep the formats of the native inputs
// they replace: "YYYY-MM-DD", "HH:mm" and "YYYY-MM-DDTHH:mm" (a wall time, no zone).

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** True for a real calendar day in "YYYY-MM-DD" form (rejects 2026-02-30). */
export function isPickerDay(value: string): boolean {
  const match = DAY.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

export function isPickerTime(value: string): boolean {
  return TIME.test(value);
}

/** "YYYY-MM-DDTHH:mm" → its parts; missing or invalid parts come back as "". */
export function splitDateTime(value: string | null | undefined): { day: string; time: string } {
  const [day = "", time = ""] = (value ?? "").trim().split("T");
  return { day: isPickerDay(day) ? day : "", time: isPickerTime(time.slice(0, 5)) ? time.slice(0, 5) : "" };
}

/** Day + time → "YYYY-MM-DDTHH:mm"; a day without a time starts at 00:00. Empty when the day is missing. */
export function joinDateTime(day: string, time: string): string {
  if (!isPickerDay(day)) return "";
  return `${day}T${isPickerTime(time) ? time : "00:00"}`;
}

export function splitTime(value: string): { hour: number; minute: number } | null {
  const match = TIME.exec(value);
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : null;
}

export function joinTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * Picker day ↔ calendar-grid Date. The grid library works with local Date objects, so a day
 * is carried as local noon of that wall date (noon keeps DST shifts from moving it).
 * This is display plumbing only: the day itself is always the "YYYY-MM-DD" string.
 */
export function dayToGridDate(day: string): Date | undefined {
  if (!isPickerDay(day)) return undefined;
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date, 12);
}

export function gridDateToDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Human label for a picker day, e.g. "14 Nov 2026" (formatted as a UTC date, so no zone can shift it). */
export function formatPickerDay(day: string, locale: string): string {
  if (!isPickerDay(day)) return "";
  const [year, month, date] = day.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(Date.UTC(year, month - 1, date));
}
