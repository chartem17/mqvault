export const SESSION_TIMEZONE = "Europe/Kyiv";

export type SessionKey =
  | "asia"
  | "frankfurt"
  | "london"
  | "london_lunch"
  | "london_pm"
  | "new_york"
  | "off_hours";

export type SessionGroup = "asia" | "london" | "new_york" | "off";

export const SESSIONS = [
  { key: "asia", label: "Asia", start: "01:00", end: "09:00", group: "asia" },
  {
    key: "frankfurt",
    label: "Frankfurt",
    start: "09:00",
    end: "10:00",
    group: "london",
  },
  {
    key: "london",
    label: "London",
    start: "10:00",
    end: "12:00",
    group: "london",
  },
  {
    key: "london_lunch",
    label: "London lunch",
    start: "12:00",
    end: "14:00",
    group: "london",
  },
  {
    key: "london_pm",
    label: "London after lunch",
    start: "14:00",
    end: "15:00",
    group: "london",
  },
  {
    key: "new_york",
    label: "New York",
    start: "15:00",
    end: "23:00",
    group: "new_york",
  },
] as const;

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function getKyivParts(input: string | Date) {
  const date = typeof input === "string" ? new Date(input) : input;
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

export function getKyivDate(input: string | Date): string {
  return getKyivParts(input).date;
}

export function getSessionKey(input: string | Date): SessionKey {
  const { hour } = getKyivParts(input);
  const found = SESSIONS.find((s) => hour >= s.startHour && hour < s.endHour);
  return found?.key ?? "off_hours";
}

export function getSessionKey(input: string | Date): SessionKey {
  const { hour, minute } = getKyivParts(input);
  const t = hour * 60 + minute;
  const found = SESSIONS.find(
    (s) => t >= toMinutes(s.start) && t < toMinutes(s.end),
  );
  return found?.key ?? "off_hours";
}

export function getDefaultKyivRange(monthsBack = 3) {
  const end = getKyivDate(new Date());
  const [y, m, d] = end.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d));
  start.setUTCMonth(start.getUTCMonth() - monthsBack);
  return { start: start.toISOString().slice(0, 10), end };
}
