import { getSessionGroup, type SessionGroup } from "../time/sessions";
import { dayKey, shiftDay, startOfZonedDay } from "../time/timezone";

export type DialSegment = { group: SessionGroup; from: number; to: number };
export type DialWindow = { start: number; end: number };

/** The user's current calendar day [start, end) as UTC ms (23 or 25 hours on DST changes). */
export function dayWindow(timezone: string, now: number): DialWindow {
  const day = dayKey(now, timezone);
  const start = startOfZonedDay(day, timezone);
  const end = startOfZonedDay(shiftDay(day, 1), timezone);
  if (start === null || end === null || end <= start) throw new RangeError("Cannot resolve the day window");
  return { start, end };
}

/** Position of an instant inside the window as 0..1, or null when outside. */
export function fractionOf(timestamp: number, window: DialWindow): number | null {
  if (!Number.isFinite(timestamp) || timestamp < window.start || timestamp >= window.end) return null;
  return (timestamp - window.start) / (window.end - window.start);
}

/** Market sessions across the window, merged into contiguous runs; sampled every `stepMinutes`. */
export function sessionSegments(window: DialWindow, stepMinutes = 10): DialSegment[] {
  const step = stepMinutes * 60_000;
  const length = window.end - window.start;
  const segments: DialSegment[] = [];
  for (let at = window.start; at < window.end; at += step) {
    const group = getSessionGroup(new Date(at));
    const from = (at - window.start) / length;
    const to = Math.min(1, (at + step - window.start) / length);
    const last = segments[segments.length - 1];
    if (last && last.group === group) last.to = to; else segments.push({ group, from, to });
  }
  return segments;
}
