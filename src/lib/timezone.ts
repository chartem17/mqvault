export const DEFAULT_TIMEZONE = "Europe/Kyiv";

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function getBrowserTimeZone(): string {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isValidTimeZone(tz) ? tz : DEFAULT_TIMEZONE;
}

export function getTimeZoneList(): string[] {
  const list = (Intl as any).supportedValuesOf?.("timeZone") as
    | string[]
    | undefined;
  return list?.length ? list : [DEFAULT_TIMEZONE, "UTC"];
}

export function getOffsetLabel(tz: string, date = new Date()): string {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "shortOffset",
  })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? "";
}

// Ключ дня "YYYY-MM-DD" у зоні користувача
export function dayKey(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function formatDateTime(
  iso: string,
  tz: string,
  locale = "uk-UA",
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: tz,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}
