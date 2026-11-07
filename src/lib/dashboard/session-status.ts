import { getSessionDisplay } from "../time/sessions";
import { matchesSessionSelection } from "../time/session-selection";
import { shiftDay, zonedParts, zonedWallTime } from "../time/timezone";

/**
 * "Can I trade now?" for the Home page: the current market session, whether the active strategy
 * allows it, and when the next allowed session opens. Sessions follow the markets' own clocks
 * (ADR 0002); the forex week runs from Sunday 17:00 to Friday 17:00 New York time.
 */
export type SessionNow = { key: string; label: string; endsAt: string };
export type SessionStatus = {
  /** Forex weekend: no session is running. */
  closed: boolean;
  /** When the forex week opens again (only while closed). */
  opensAt: string | null;
  current: SessionNow | null;
  /** null: the strategy has no session rule (or none is selected). */
  allowed: boolean | null;
  /** Start of the next session the strategy allows, when the current one is not allowed. */
  nextAllowed: SessionNow & { startsAt: string } | null;
};

const NEW_YORK = "America/New_York";
const STEP_MS = 5 * 60_000;
const HORIZON_MS = 8 * 86_400_000;

function weekday(day: string) { return new Date(`${day}T00:00:00Z`).getUTCDay(); }

/** True between Friday 17:00 and Sunday 17:00 in New York (forex and metals are closed). */
export function isForexWeekend(at: number): boolean {
  const { date, hour } = zonedParts(at, NEW_YORK);
  const day = weekday(date);
  return day === 6 || (day === 5 && hour >= 17) || (day === 0 && hour < 17);
}

function sessionAt(at: number): SessionNow & { startsAt: string; group: string } {
  const display = getSessionDisplay(new Date(at));
  return { key: display.key, label: display.label, group: display.group, startsAt: display.startAt, endsAt: display.endAt };
}

/** When the forex week reopens after `from` (Sunday 17:00 New York); `from` itself when the market is open. */
export function weekOpen(from: number): number {
  if (!isForexWeekend(from)) return from;
  const { date } = zonedParts(from, NEW_YORK);
  return zonedWallTime(shiftDay(date, (7 - weekday(date)) % 7), "17:00", NEW_YORK);
}

export function sessionStatus(now: Date, allowedSessions: string[] | null): SessionStatus {
  const at = now.getTime();
  const allows = (session: { key: string; group: string }) => allowedSessions === null || matchesSessionSelection({ sessionKey: session.key, sessionGroup: session.group }, allowedSessions);

  if (isForexWeekend(at)) {
    const open = weekOpen(at);
    let next = null;
    if (allowedSessions !== null) {
      for (let probe = open; probe - at < HORIZON_MS; probe += STEP_MS) {
        if (isForexWeekend(probe)) continue;
        const session = sessionAt(probe);
        if (allows(session)) { next = { key: session.key, label: session.label, endsAt: session.endsAt, startsAt: new Date(Math.max(Date.parse(session.startsAt), open)).toISOString() }; break; }
      }
    }
    return { closed: true, opensAt: new Date(open).toISOString(), current: null, allowed: null, nextAllowed: next };
  }

  const current = sessionAt(at);
  const allowed = allowedSessions === null ? null : allows(current);
  let nextAllowed = null;
  if (allowed === false) {
    // Walk session by session from the end of the current one.
    for (let probe = Date.parse(current.endsAt); probe - at < HORIZON_MS; ) {
      if (isForexWeekend(probe)) { probe = weekOpen(probe); continue; }
      const session = sessionAt(probe);
      if (allows(session)) { nextAllowed = { key: session.key, label: session.label, endsAt: session.endsAt, startsAt: new Date(Math.max(Date.parse(session.startsAt), probe)).toISOString() }; break; }
      const end = Date.parse(session.endsAt);
      probe = end > probe ? end : probe + STEP_MS;
    }
  }
  return { closed: false, opensAt: null, current: { key: current.key, label: current.label, endsAt: current.endsAt }, allowed, nextAllowed };
}
