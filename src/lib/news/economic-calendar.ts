/**
 * Economic calendar: one site-wide table of macro events (`news_events`), filled by the server.
 * Main source is the MetaTrader 5 calendar (ADR 0013). This module is pure and dependency-free:
 * it is used by `/api/economic-calendar`, by the CSV importer in `tools/econ-calendar/` (run with
 * `node --experimental-strip-types`, so keep it free of imports and non-erasable TS syntax) and by tests.
 */

export type CalendarImpact = "high" | "medium" | "low" | "holiday" | "none";
export type CalendarEventType = "indicator" | "event" | "holiday";
export type CalendarMultiplier = "none" | "thousands" | "millions" | "billions" | "trillions";
export type LicenseScope = "private" | "public_ok";

export const CALENDAR_IMPACTS: readonly CalendarImpact[] = ["high", "medium", "low", "holiday", "none"];
const EVENT_TYPES: readonly CalendarEventType[] = ["indicator", "event", "holiday"];
const MULTIPLIERS: readonly CalendarMultiplier[] = ["none", "thousands", "millions", "billions", "trillions"];
/** Currencies of the owner's 28 pairs; the calendar covers exactly these. */
export const CALENDAR_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "NZD", "CHF"] as const;

/** Row shape accepted by the `import_news_events(jsonb)` RPC. */
export type NewsEventImportRow = {
  source: string;
  external_id: string;
  title: string;
  country: string | null;
  currency: string | null;
  impact: CalendarImpact;
  event_time: string;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  unit: string | null;
  event_code: string | null;
  source_series_id: string | null;
  event_type: CalendarEventType | null;
  sector: string | null;
  frequency: string | null;
  all_day: boolean;
  tentative: boolean;
  period: string | null;
  revision: number | null;
  actual_value: number | null;
  forecast_value: number | null;
  previous_value: number | null;
  revised_previous_value: number | null;
  multiplier: CalendarMultiplier | null;
  digits: number | null;
  forecast_suspect: boolean;
  license_scope: LicenseScope;
};

// ---------- CSV ----------

/** Minimal RFC 4180 parser (comma, quotes, CRLF, BOM). The clean calendar file is machine-written. */
export function parseCsvRecords(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); if (row.length > 1 || row[0] !== "") rows.push(row); }
  const [header, ...body] = rows;
  if (!header) return [];
  return body.map(cells => Object.fromEntries(header.map((name, i) => [name.trim(), cells[i] ?? ""])));
}

const numberOrNull = (raw: string | undefined): number | null => {
  if (raw === undefined || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};
const textOrNull = (raw: string | undefined, max = 200): string | null => {
  const v = (raw ?? "").trim();
  return v ? v.slice(0, max) : null;
};
/** "kings-birthday" → "Kings Birthday". */
export function titleFromCode(code: string | undefined): string | null {
  const words = (code ?? "").trim().split(/[-_\s]+/).filter(Boolean);
  return words.length ? words.map(w => w[0].toUpperCase() + w.slice(1)).join(" ").slice(0, 200) : null;
}
const bool = (raw: string | undefined) => (raw ?? "").trim().toLowerCase() === "true";
const oneOf = <T extends string>(raw: string | undefined, allowed: readonly T[]): T | null => {
  const v = (raw ?? "").trim().toLowerCase();
  return (allowed as readonly string[]).includes(v) ? (v as T) : null;
};

/**
 * Maps one record of `mqvault_calendar_clean.csv` (see clean_calendar.py) to an import row.
 * Returns a reason instead of a row when the record cannot be imported.
 */
export function calendarRowFromCsv(record: Record<string, string>): { row: NewsEventImportRow } | { error: string } {
  const source = textOrNull(record.source, 40);
  const externalId = textOrNull(record.source_event_id, 80);
  // MT5 sometimes ships an empty name (e.g. "kings-birthday" holidays): fall back to the event code.
  const title = textOrNull(record.title, 200) ?? titleFromCode(record.event_code);
  const at = (record.scheduled_at ?? "").trim();
  if (!source || !externalId) return { error: "missing source or source_event_id" };
  if (!title) return { error: "missing title" };
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?Z$/.test(at) || !Number.isFinite(Date.parse(at))) return { error: "scheduled_at is not a UTC timestamp" };
  const impact = oneOf(record.impact, CALENDAR_IMPACTS);
  if (!impact) return { error: `unknown impact "${record.impact}"` };
  const currency = textOrNull(record.currency, 3)?.toUpperCase() ?? null;
  const period = /^\d{4}-\d{2}-\d{2}$/.test((record.period ?? "").trim()) ? record.period.trim() : null;
  const multiplier = oneOf(record.multiplier, MULTIPLIERS);
  const unit = textOrNull(record.unit, 40)?.toLowerCase() ?? null;
  const digitsRaw = numberOrNull(record.digits);
  const digits = digitsRaw === null ? null : Math.max(0, Math.min(6, Math.round(digitsRaw)));
  const revisionRaw = numberOrNull(record.revision);
  const values = {
    actual: numberOrNull(record.actual),
    forecast: numberOrNull(record.forecast),
    previous: numberOrNull(record.previous),
    revised: numberOrNull(record.revised_previous),
  };
  const fmt = (v: number | null) => formatCalendarValue(v, { unit, multiplier, digits });
  return {
    row: {
      source: source.toLowerCase(),
      external_id: externalId,
      title,
      country: textOrNull(record.country, 3)?.toUpperCase() ?? null,
      currency,
      impact,
      event_time: new Date(at).toISOString(),
      actual: fmt(values.actual),
      forecast: fmt(values.forecast),
      previous: fmt(values.revised ?? values.previous),
      unit,
      event_code: textOrNull(record.event_code, 120),
      source_series_id: textOrNull(record.mt5_event_id, 40),
      event_type: oneOf(record.event_type, EVENT_TYPES),
      sector: textOrNull(record.sector, 40)?.toLowerCase() ?? null,
      frequency: textOrNull(record.frequency, 40)?.toLowerCase() ?? null,
      all_day: bool(record.all_day),
      tentative: bool(record.tentative),
      period,
      revision: revisionRaw === null ? null : Math.round(revisionRaw),
      actual_value: values.actual,
      forecast_value: values.forecast,
      previous_value: values.previous,
      revised_previous_value: values.revised,
      multiplier,
      digits,
      forecast_suspect: bool(record.forecast_suspect),
      license_scope: "private",
    },
  };
}

// ---------- values ----------

const SUFFIX: Record<CalendarMultiplier, string> = { none: "", thousands: "K", millions: "M", billions: "B", trillions: "T" };

/** Display value as traders read it: 216 + thousands → "216K", 0.6 + percent → "0.6%". */
export function formatCalendarValue(value: number | null, opts: { unit: string | null; multiplier: CalendarMultiplier | null; digits: number | null }): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  const digits = opts.digits ?? 2;
  const text = value.toFixed(digits);
  const suffix = opts.multiplier ? SUFFIX[opts.multiplier] : "";
  return `${text === `-${(0).toFixed(digits)}` ? text.slice(1) : text}${suffix}${opts.unit === "percent" ? "%" : ""}`;
}

/**
 * Actual minus forecast, in the event's own units. Null when either is missing or the forecast
 * is flagged as suspect (data error upstream) — such rows must not feed "surprise" statistics.
 */
export function calendarSurprise(actual: number | null, forecast: number | null, forecastSuspect: boolean): number | null {
  if (forecastSuspect || actual === null || forecast === null) return null;
  const diff = actual - forecast;
  return Math.round(diff * 1e6) / 1e6;
}

// ---------- API ----------

export const CALENDAR_MAX_RANGE_DAYS = 93;
const DAY_MS = 86_400_000;

export type CalendarQuery = {
  from: Date;
  to: Date;
  currencies: string[] | null;
  impacts: CalendarImpact[];
};

/**
 * Validates `/api/economic-calendar` query params. Instants only: the client turns the user's
 * local week into UTC instants (ADR 0001), the server never guesses a timezone.
 * Defaults: yesterday → +7 days, high + medium + holiday, currencies decided by the caller.
 */
export function parseCalendarQuery(params: URLSearchParams, now: Date = new Date()): { query: CalendarQuery } | { error: string } {
  const from = params.get("from") ? new Date(params.get("from") as string) : new Date(now.getTime() - DAY_MS);
  const to = params.get("to") ? new Date(params.get("to") as string) : new Date(now.getTime() + 7 * DAY_MS);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return { error: "Invalid date range" };
  if (to.getTime() <= from.getTime()) return { error: "`to` must be after `from`" };
  if (to.getTime() - from.getTime() > CALENDAR_MAX_RANGE_DAYS * DAY_MS) return { error: `Range is limited to ${CALENDAR_MAX_RANGE_DAYS} days` };

  const list = (key: string) => (params.get(key) ?? "").split(",").map(v => v.trim()).filter(Boolean);
  const currencyParam = list("currencies").map(c => c.toUpperCase());
  if (currencyParam.some(c => !/^[A-Z]{3}$/.test(c))) return { error: "Invalid currency" };
  const impactParam = list("impact").map(v => v.toLowerCase());
  if (impactParam.some(v => !(CALENDAR_IMPACTS as readonly string[]).includes(v))) return { error: "Invalid impact" };

  return {
    query: {
      from,
      to,
      currencies: currencyParam.length ? [...new Set(currencyParam)] : null,
      impacts: impactParam.length ? [...new Set(impactParam)] as CalendarImpact[] : ["high", "medium", "holiday"],
    },
  };
}

const PAIR_RE = /^([A-Z]{3})([A-Z]{3})/;
/** Calendar currencies touched by the user's traded symbols ("EURUSD.m" → EUR, USD). */
export function currenciesFromTrades(rows: { base_asset?: string | null; quote_asset?: string | null; symbol?: string | null }[]): string[] {
  const known = new Set<string>(CALENDAR_CURRENCIES);
  const out = new Set<string>();
  for (const row of rows) {
    const base = (row.base_asset ?? "").toUpperCase();
    const quote = (row.quote_asset ?? "").toUpperCase();
    const fromSymbol = PAIR_RE.exec((row.symbol ?? "").toUpperCase().replace(/[^A-Z]/g, ""));
    for (const c of [base, quote, fromSymbol?.[1] ?? "", fromSymbol?.[2] ?? ""]) if (known.has(c)) out.add(c);
  }
  return CALENDAR_CURRENCIES.filter(c => out.has(c));
}

export type NewsEventRecord = {
  id: string;
  title: string;
  country: string | null;
  currency: string | null;
  impact: string | null;
  event_time: string;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  event_type: string | null;
  all_day: boolean | null;
  tentative: boolean | null;
  actual_value: number | string | null;
  forecast_value: number | string | null;
  forecast_suspect: boolean | null;
  source: string;
};

export type CalendarEvent = {
  id: string;
  time: string;
  currency: string | null;
  country: string | null;
  title: string;
  impact: CalendarImpact;
  eventType: CalendarEventType | null;
  allDay: boolean;
  tentative: boolean;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  surprise: number | null;
  forecastSuspect: boolean;
  source: string;
};

const asNumber = (v: number | string | null): number | null => {
  if (v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** DB row → API event. PostgREST returns numeric as string or number; both are accepted. */
export function toCalendarEvent(row: NewsEventRecord): CalendarEvent {
  const suspect = row.forecast_suspect === true;
  const impact = oneOf(row.impact ?? undefined, CALENDAR_IMPACTS) ?? "none";
  return {
    id: row.id,
    time: new Date(row.event_time).toISOString(),
    currency: row.currency,
    country: row.country,
    title: row.title,
    impact,
    eventType: oneOf(row.event_type ?? undefined, EVENT_TYPES),
    allDay: row.all_day === true,
    tentative: row.tentative === true,
    actual: row.actual,
    forecast: row.forecast,
    previous: row.previous,
    surprise: calendarSurprise(asNumber(row.actual_value), asNumber(row.forecast_value), suspect),
    forecastSuspect: suspect,
    source: row.source,
  };
}

// ---------- raw MT5 values (live sync) ----------

/**
 * One value as the MT5 EA sends it: the same fields as the raw export CSV (see
 * tools/mt5/MQVault_CalendarExport.mq5), enums as MQL5 names, values as decimal strings, time in server time.
 */
export type Mt5RawValue = Record<string, string | number | null | undefined>;

const str = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v)).trim();
const stripEnum = (v: string, prefix: string) => str(v).replace(prefix, "").toLowerCase();
const RAW_IMPORTANCE: Record<string, CalendarImpact> = { HIGH: "high", MODERATE: "medium", LOW: "low", NONE: "none" };

/**
 * Raw MT5 value → record in the clean CSV shape (same rules as clean_calendar.py), ready for
 * calendarRowFromCsv. UTC = server time − the server's current offset (MT5 reports all times with it).
 * forecast_suspect is left "false": it needs the series history (see forecastLooksSuspect).
 */
export function cleanRecordFromMt5(raw: Mt5RawValue, offsetMinutes: number): { record: Record<string, string> } | { error: string } {
  const valueId = str(raw.value_id), eventId = str(raw.event_id);
  if (!/^\d{1,20}$/.test(valueId) || !/^\d{1,20}$/.test(eventId)) return { error: "missing value_id or event_id" };
  if (!Number.isInteger(offsetMinutes) || Math.abs(offsetMinutes) > 14 * 60) return { error: "invalid server offset" };
  const m = /^(\d{4})[-.](\d{2})[-.](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(str(raw.server_time));
  if (!m) return { error: "invalid server_time" };
  const serverMs = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
  const utc = new Date(serverMs - offsetMinutes * 60_000);
  if (Number.isNaN(utc.getTime())) return { error: "invalid server_time" };
  const eventType = stripEnum(str(raw.event_type), "CALENDAR_TYPE_");
  const importance = RAW_IMPORTANCE[str(raw.importance).split("_").pop() ?? ""];
  if (eventType !== "holiday" && !importance) return { error: `unknown importance "${str(raw.importance)}"` };
  const timeMode = str(raw.time_mode);
  const period = str(raw.period);
  return {
    record: {
      source: "mt5",
      source_event_id: valueId,
      mt5_event_id: eventId,
      event_code: str(raw.event_code),
      title: str(raw.event_name),
      country: str(raw.country_code),
      currency: str(raw.currency),
      impact: eventType === "holiday" ? "holiday" : importance,
      event_type: eventType,
      sector: stripEnum(str(raw.sector), "CALENDAR_SECTOR_"),
      frequency: stripEnum(str(raw.frequency), "CALENDAR_FREQUENCY_"),
      all_day: String(timeMode === "CALENDAR_TIMEMODE_DATE"),
      tentative: String(timeMode === "CALENDAR_TIMEMODE_TENTATIVE"),
      scheduled_at: utc.toISOString().replace(".000Z", "Z"),
      period: period.startsWith("1970") ? "" : period,
      revision: str(raw.revision),
      actual: str(raw.actual),
      forecast: str(raw.forecast),
      previous: str(raw.previous),
      revised_previous: str(raw.revised_previous),
      unit: stripEnum(str(raw.unit), "CALENDAR_UNIT_"),
      multiplier: stripEnum(str(raw.multiplier), "CALENDAR_MULTIPLIER_"),
      digits: str(raw.digits),
      forecast_suspect: "false",
    },
  };
}

/**
 * Same rule as clean_calendar.py: a forecast is suspect when it is farther than 8× the series' typical
 * release-to-release change (median of |Δactual|, needs ≥ 6 changes) from both previous and actual.
 * `seriesActuals` are the series' actual values in time order.
 */
export function forecastLooksSuspect(forecast: number | null, previous: number | null, actual: number | null, seriesActuals: number[]): boolean {
  if (forecast === null) return false;
  const refs = [previous, actual].filter((v): v is number => v !== null);
  if (!refs.length) return false;
  const diffs = seriesActuals.slice(1).map((v, i) => Math.abs(v - seriesActuals[i]));
  if (diffs.length < 6) return false;
  const sorted = [...diffs].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const scale = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  if (scale === 0) return false;
  return Math.min(...refs.map(v => Math.abs(forecast - v))) > 8 * scale;
}
