export const SESSION_TIMEZONE = "Europe/Kyiv";
export type SessionKey = "asia" | "frankfurt" | "london" | "london_lunch" | "london_pm" | "new_york" | "off_hours";
export type SessionGroup = "asia" | "london" | "new_york" | "off";
export const SESSIONS = [
  { key: "asia", label: "Asia", start: "01:00", end: "09:00", group: "asia" },
  { key: "frankfurt", label: "Frankfurt", start: "09:00", end: "10:00", group: "london" },
  { key: "london", label: "London", start: "10:00", end: "12:00", group: "london" },
  { key: "london_lunch", label: "London lunch", start: "12:00", end: "14:00", group: "london" },
  { key: "london_pm", label: "London after lunch", start: "14:00", end: "15:00", group: "london" },
  { key: "new_york", label: "New York", start: "15:00", end: "23:00", group: "new_york" },
] as const;
export const SESSION_DEFINITIONS = [...SESSIONS, { key: "off_hours", label: "Off hours", start: "23:00", end: "01:00", group: "off" }] as const;
export const SESSION_GROUPS = [{ key: "asia", label: "Asia" }, { key: "london", label: "London" }, { key: "new_york", label: "New York" }, { key: "off", label: "Off hours" }] as const;
const formatters = new Map<string, Intl.DateTimeFormat>();
const minutes = (value: string) => { const [hour, minute] = value.split(":").map(Number); return hour * 60 + minute; };
function dateOf(input: string | Date) {
  const date = input instanceof Date ? new Date(input.getTime()) : new Date(input);
  if (!Number.isFinite(date.getTime())) throw new RangeError("Invalid session timestamp");
  return date;
}
function partsIn(input: string | Date, timezone: string) {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    formatters.set(timezone, formatter);
  }
  const parts = Object.fromEntries(formatter.formatToParts(dateOf(input)).map(part => [part.type, part.value]));
  return { date: `${parts.year.padStart(4, "0")}-${parts.month}-${parts.day}`, hour: Number(parts.hour), minute: Number(parts.minute) };
}
export function getKyivParts(input: string | Date) { return partsIn(input, SESSION_TIMEZONE); }
export function getKyivDate(input: string | Date): string { return getKyivParts(input).date; }
export function getSessionKey(input: string | Date): SessionKey {
  const { hour, minute } = getKyivParts(input);
  const time = hour * 60 + minute;
  return SESSIONS.find(session => time >= minutes(session.start) && time < minutes(session.end))?.key ?? "off_hours";
}
function definitionFor(key: SessionKey) {
  const definition = SESSION_DEFINITIONS.find(session => session.key === key);
  if (!definition) throw new RangeError("Unknown session key");
  return definition;
}
export function getSessionGroup(input: string | Date): SessionGroup { return definitionFor(getSessionKey(input)).group; }
export function getSessionLabel(input: string | Date) { return definitionFor(getSessionKey(input)).label; }
function calendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError("Invalid session date");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new RangeError("Invalid session date");
  return date;
}
function shiftDay(day: string, difference: number) { const date = calendarDate(day); date.setUTCDate(date.getUTCDate() + difference); return date.toISOString().slice(0, 10); }
function kyivWallTime(day: string, time: string) {
  calendarDate(day);
  const target = Date.parse(`${day}T${time}:00.000Z`);
  let candidate = target;
  for (let attempt = 0; attempt < 6; attempt++) {
    const parts = getKyivParts(new Date(candidate));
    const wall = Date.parse(`${parts.date}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}:00.000Z`);
    if (wall === target) return new Date(candidate).toISOString();
    candidate += target - wall;
  }
  throw new RangeError("Session boundary cannot be resolved in Europe/Kyiv");
}
export function getSessionBounds(key: SessionKey, sourceDate: string) {
  const session = definitionFor(key);
  const endDate = minutes(session.end) <= minutes(session.start) ? shiftDay(sourceDate, 1) : sourceDate;
  return { ...session, sourceDate, startAt: kyivWallTime(sourceDate, session.start), endAt: kyivWallTime(endDate, session.end) };
}
export function getSessionDisplay(input: string | Date, displayTimezone = SESSION_TIMEZONE) {
  const date = dateOf(input);
  const key = getSessionKey(date);
  const source = getKyivParts(date);
  const sourceDate = key === "off_hours" && source.hour < 1 ? shiftDay(source.date, -1) : source.date;
  const bounds = getSessionBounds(key, sourceDate);
  const start = partsIn(bounds.startAt, displayTimezone);
  const end = partsIn(bounds.endAt, displayTimezone);
  const clock = (parts: { hour: number; minute: number }) => `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
  const dayOffset = (calendarDate(end.date).getTime() - calendarDate(start.date).getTime()) / 86400000;
  return { ...bounds, timezone: displayTimezone, start: clock(start), end: clock(end), startDate: start.date, endDate: end.date, dayOffset };
}
export function getDefaultKyivRange(monthsBack = 3) {
  const end = getKyivDate(new Date());
  const start = calendarDate(end);
  start.setUTCMonth(start.getUTCMonth() - monthsBack);
  return { start: start.toISOString().slice(0, 10), end };
}
