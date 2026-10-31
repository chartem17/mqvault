import { getKyivDate } from "./sessions";

export function calendarCellKey(date: Date): string {
  if (!Number.isFinite(date.getTime())) throw new RangeError("Invalid calendar date");
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function kyivDayOrNull(timestamp: string): string | null {
  try { return getKyivDate(timestamp); } catch { return null; }
}
export function kyivMonthCursor(now = new Date()): Date {
  const [year, month] = getKyivDate(now).split("-").map(Number);
  return new Date(year, month - 1, 1, 12);
}
function validDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function isInKyivPeriod(timestamp: string, period: { start: string; end: string }): boolean {
  if (!validDay(period.start) || !validDay(period.end) || period.start > period.end) return false;
  const day = kyivDayOrNull(timestamp);
  return day !== null && day >= period.start && day <= period.end;
}
export function defaultKyivPeriod(monthsBack = 3, now = new Date()): { start: string; end: string } {
  if (!Number.isInteger(monthsBack) || monthsBack < 0) throw new RangeError("Invalid monthsBack");
  const end = getKyivDate(now);
  const [year, month, day] = end.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 - monthsBack, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return { start: target.toISOString().slice(0, 10), end };
}
