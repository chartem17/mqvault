/**
 * Trading sessions anchored to each market's own local time.
 *
 * Every session STARTS at a wall-clock time in its market's time zone and
 * lasts until the next session starts. Classification therefore does not
 * depend on the viewer's time zone and stays correct across DST changes,
 * including the weeks when the US and Europe switch on different dates.
 *
 * Outside those mismatch weeks the boundaries equal the previous
 * Kyiv-clock definitions (Asia 01:00, Frankfurt 09:00, London 10:00,
 * lunch 12:00, after lunch 14:00, New York 15:00, Off hours 23:00 Kyiv).
 *
 * When two sessions start at the same instant (mismatch weeks: New York
 * 08:00 = London 12:00), the later one in the list wins, so New York
 * takes over and London after lunch is skipped that day.
 */
import { shiftDay as shiftCalendarDay, zonedParts, zonedWallTime } from "./timezone";
export { zonedWallTime } from "./timezone";
export const SESSION_TIMEZONE = "Europe/Kyiv"; // legacy reference zone, kept for Kyiv helpers below
export type SessionKey = "asia" | "frankfurt" | "london" | "london_lunch" | "london_pm" | "new_york" | "off_hours";
export type SessionGroup = "asia" | "london" | "new_york" | "off";

type SessionDefinition = {
  key: SessionKey; label: string; group: SessionGroup;
  /** Market time zone the start is anchored to. */
  zone: string;
  /** Start wall-clock time in `zone`. */
  start: string;
  /** Calendar-day offset of the anchor relative to the session's source date (Asia starts the previous New York evening). */
  dayOffset: number;
};

// Ordered by start within a source day; on equal instants the later entry wins.
export const SESSION_DEFINITIONS: readonly SessionDefinition[] = [
  { key: "asia", label: "Asia", group: "asia", zone: "America/New_York", start: "18:00", dayOffset: -1 },
  { key: "frankfurt", label: "Frankfurt", group: "london", zone: "Europe/Berlin", start: "08:00", dayOffset: 0 },
  { key: "london", label: "London", group: "london", zone: "Europe/London", start: "08:00", dayOffset: 0 },
  { key: "london_lunch", label: "London lunch", group: "london", zone: "Europe/London", start: "10:00", dayOffset: 0 },
  { key: "london_pm", label: "London after lunch", group: "london", zone: "Europe/London", start: "12:00", dayOffset: 0 },
  { key: "new_york", label: "New York", group: "new_york", zone: "America/New_York", start: "08:00", dayOffset: 0 },
  { key: "off_hours", label: "Off hours", group: "off", zone: "America/New_York", start: "16:00", dayOffset: 0 },
] as const;
export const SESSIONS = SESSION_DEFINITIONS.filter(session => session.key !== "off_hours");
export const SESSION_GROUPS = [{ key: "asia", label: "Asia" }, { key: "london", label: "London" }, { key: "new_york", label: "New York" }, { key: "off", label: "Off hours" }] as const;

function dateOf(input: string | Date) {
  const date = input instanceof Date ? new Date(input.getTime()) : new Date(input);
  if (!Number.isFinite(date.getTime())) throw new RangeError("Invalid session timestamp");
  return date;
}
function partsIn(input: string | Date, timezone: string) { return zonedParts(dateOf(input), timezone); }
function calendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError("Invalid session date");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new RangeError("Invalid session date");
  return date;
}
function shiftDay(day: string, difference: number) { calendarDate(day); return shiftCalendarDay(day, difference); }

type Boundary = { key: SessionKey; sourceDate: string; at: number; rank: number };
const boundaryCache = new Map<string, Boundary[]>();
function boundariesAround(at: number): Boundary[] {
  const utcDay = new Date(at).toISOString().slice(0, 10);
  const cached = boundaryCache.get(utcDay);
  if (cached) return cached;
  const list: Boundary[] = [];
  for (let offset = -2; offset <= 2; offset++) {
    const sourceDate = shiftDay(utcDay, offset);
    SESSION_DEFINITIONS.forEach((session, index) => {
      list.push({ key: session.key, sourceDate, at: zonedWallTime(shiftDay(sourceDate, session.dayOffset), session.start, session.zone), rank: offset * 100 + index });
    });
  }
  list.sort((a, b) => a.at - b.at || a.rank - b.rank);
  if (boundaryCache.size > 2000) boundaryCache.clear();
  boundaryCache.set(utcDay, list);
  return list;
}
/** The session boundary in force at `at`: the latest start ≤ at (ties → later definition). */
function boundaryAt(at: number): { current: Boundary; next: Boundary } {
  const list = boundariesAround(at);
  let index = -1;
  for (let i = 0; i < list.length; i++) if (list[i].at <= at) index = i;
  if (index < 0 || index >= list.length - 1) throw new RangeError("Session boundary cannot be resolved");
  let next = index + 1;
  while (next < list.length && list[next].at === list[index].at) next++;
  return { current: list[index], next: list[next] };
}

export function getKyivParts(input: string | Date) { return partsIn(input, SESSION_TIMEZONE); }
export function getKyivDate(input: string | Date): string { return getKyivParts(input).date; }

export function getSessionKey(input: string | Date): SessionKey {
  return boundaryAt(dateOf(input).getTime()).current.key;
}
function definitionFor(key: SessionKey) {
  const definition = SESSION_DEFINITIONS.find(session => session.key === key);
  if (!definition) throw new RangeError("Unknown session key");
  return definition;
}
export function getSessionGroup(input: string | Date): SessionGroup { return definitionFor(getSessionKey(input)).group; }
export function getSessionLabel(input: string | Date) { return definitionFor(getSessionKey(input)).label; }

/**
 * Bounds of a session for a source date. In DST-mismatch weeks a session can
 * be fully overtaken by the next one; then startAt === endAt.
 */
export function getSessionBounds(key: SessionKey, sourceDate: string) {
  const session = definitionFor(key);
  const start = zonedWallTime(shiftDay(sourceDate, session.dayOffset), session.start, session.zone);
  const list = boundariesAround(start);
  const own = list.findIndex(item => item.key === key && item.sourceDate === sourceDate);
  let next = own + 1;
  while (next < list.length && list[next].at <= start) next++;
  const end = list[next].at;
  // Overtaken: a later boundary with the same instant wins over this one.
  const overtaken = list.some((item, index) => index > own && item.at === start);
  return { ...session, sourceDate, startAt: new Date(start).toISOString(), endAt: new Date(overtaken ? start : end).toISOString() };
}

export function getSessionDisplay(input: string | Date, displayTimezone = SESSION_TIMEZONE) {
  const at = dateOf(input).getTime();
  partsIn(new Date(at), displayTimezone); // validates the zone (throws RangeError)
  const { current, next } = boundaryAt(at);
  const session = definitionFor(current.key);
  const start = partsIn(new Date(current.at), displayTimezone);
  const end = partsIn(new Date(next.at), displayTimezone);
  const clock = (parts: { hour: number; minute: number }) => `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
  const dayOffset = (calendarDate(end.date).getTime() - calendarDate(start.date).getTime()) / 86400000;
  return {
    ...session, sourceDate: current.sourceDate,
    startAt: new Date(current.at).toISOString(), endAt: new Date(next.at).toISOString(),
    timezone: displayTimezone, start: clock(start), end: clock(end), startDate: start.date, endDate: end.date, dayOffset,
  };
}
export function getDefaultKyivRange(monthsBack = 3) {
  const end = getKyivDate(new Date());
  const start = calendarDate(end);
  start.setUTCMonth(start.getUTCMonth() - monthsBack);
  return { start: start.toISOString().slice(0, 10), end };
}
