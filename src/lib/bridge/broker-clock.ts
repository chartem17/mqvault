/**
 * Broker server clock (ADR 0001, features/mt5-bridge.md §5.3, §9.3).
 *
 * MT5 reports deal times as the broker server's wall clock disguised as UTC seconds. To store a real instant we
 * need the server's zone. The Bridge sends the server time of the first H1 bar of each forex week; the forex week
 * opens on Sunday 17:00 New York, so each bar gives that week's offset, and the zone whose offsets match best wins.
 */
import { FX_NY7_ZONE, zoneOffsetMinutes, zonedWallTime } from "../time/timezone";

const NEW_YORK = "America/New_York";
const DAY_MS = 86_400_000;

/** Zones tried for an MT5 server, most common first (ties go to the earlier one). */
export const BROKER_ZONE_CANDIDATES = [
  FX_NY7_ZONE, "Europe/Kyiv", "Etc/UTC", "Europe/London", "Etc/GMT-2", "Etc/GMT-3", "Europe/Berlin", "America/New_York", "Asia/Tokyo", "Australia/Sydney",
] as const;

function pad(value: number) { return String(value).padStart(2, "0"); }

/** Server wall-clock milliseconds (as MT5 reports them) → UTC milliseconds, given the server's zone. */
export function serverWallToUtcMs(serverMs: number, zone: string): number {
  if (!Number.isFinite(serverMs)) throw new RangeError("Invalid server time");
  const wall = new Date(serverMs);
  const day = `${wall.getUTCFullYear()}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())}`;
  const minuteStart = Math.floor(serverMs / 60_000) * 60_000;
  return zonedWallTime(day, `${pad(wall.getUTCHours())}:${pad(wall.getUTCMinutes())}`, zone) + (serverMs - minuteStart);
}

export type WeekOffset = { weekOpenUtcMs: number; offsetMinutes: number };

/**
 * Offset of each week from the server time of its first bar. A bar is attributed to the forex open of the Sunday on
 * or before its server date. Weeks whose offset is not a whole quarter-hour or exceeds ±14h (late holiday opens,
 * gaps in data) are dropped.
 */
export function weeklyOffsets(weekStartsServerMs: readonly number[]): WeekOffset[] {
  const result: WeekOffset[] = [];
  for (const serverMs of weekStartsServerMs) {
    if (!Number.isFinite(serverMs)) continue;
    const wall = new Date(serverMs);
    const sunday = new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate()) - wall.getUTCDay() * DAY_MS);
    const day = `${sunday.getUTCFullYear()}-${pad(sunday.getUTCMonth() + 1)}-${pad(sunday.getUTCDate())}`;
    const openUtc = zonedWallTime(day, "17:00", NEW_YORK);
    const offset = Math.round((serverMs - openUtc) / 60_000);
    if (offset % 15 !== 0 || Math.abs(offset) > 14 * 60) continue;
    result.push({ weekOpenUtcMs: openUtc, offsetMinutes: offset });
  }
  return result;
}

export type ZoneSuggestion = { zone: string; matched: number; weeks: number };

/**
 * The candidate zone that explains the most weeks; null when there are fewer than `minWeeks` weeks or the best zone
 * explains less than `minShare` of them (an unusual server: the owner picks the zone by hand).
 */
export function suggestBrokerZone(offsets: readonly WeekOffset[], minWeeks = 4, minShare = 0.8): ZoneSuggestion | null {
  if (offsets.length < minWeeks) return null;
  let best: ZoneSuggestion | null = null;
  for (const zone of BROKER_ZONE_CANDIDATES) {
    const matched = offsets.filter(week => zoneOffsetMinutes(week.weekOpenUtcMs, zone) === week.offsetMinutes).length;
    if (!best || matched > best.matched) best = { zone, matched, weeks: offsets.length };
  }
  return best && best.matched / best.weeks >= minShare ? best : null;
}

/** True when a live offset measurement disagrees with the account's zone right now (shown as a warning, never auto-fixed). */
export function offsetDisagrees(zone: string, measuredOffsetMinutes: number, at: number): boolean {
  return zoneOffsetMinutes(at, zone) !== measuredOffsetMinutes;
}
