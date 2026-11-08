import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { safeEqual } from "@/lib/auth/session-token";
import { CALENDAR_CURRENCIES, calendarRowFromCsv, cleanRecordFromMt5, forecastLooksSuspect, type Mt5RawValue, type NewsEventImportRow } from "@/lib/news/economic-calendar";

export const dynamic = "force-dynamic";
const MAX_ROWS = 2000;
const MAX_BYTES = 2_000_000;
const MIN_TOKEN_LENGTH = 32;
const RPC_BATCH = 1000;
const PAGE = 1000;
const MAX_HISTORY_ROWS = 60_000;
const ID_CHUNK = 150;
const HISTORY_YEARS = 6;
const chunks = <T,>(items: T[], size: number) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const WANTED = new Set<string>(CALENDAR_CURRENCIES);

/**
 * POST /api/economic-calendar/sync — the MT5 EA on the owner's PC (tools/mt5/MQVault_CalendarSync.mq5)
 * pushes new and changed calendar values. Auth: `Authorization: Bearer <CALENDAR_SYNC_TOKEN>`, no session
 * (ADR 0015). Body: { offset_min: server UTC offset in minutes, rows: raw MT5 values (export CSV fields) }.
 * Rows are normalised like clean_calendar.py, suspect forecasts are checked against the series history,
 * and written with import_news_events (only changed rows). Low-importance and non-calendar currencies are skipped.
 */
export async function POST(request: Request) {
  const token = process.env.CALENDAR_SYNC_TOKEN ?? "";
  if (token.length < MIN_TOKEN_LENGTH) return json({ error: "Calendar sync is not configured" }, 503);
  const header = request.headers.get("authorization") ?? "";
  const provided = header.length <= 512 && header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!(await safeEqual(provided, token))) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return json({ error: "Invalid token" }, 401);
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES) return json({ error: "Payload too large" }, 413);

  const text = await request.text();
  if (text.length > MAX_BYTES) return json({ error: "Payload too large" }, 413);
  let body: { offset_min?: unknown; rows?: unknown };
  try { body = JSON.parse(text); } catch { return json({ error: "Invalid JSON" }, 400); }
  const offset = Number(body?.offset_min);
  if (!Number.isInteger(offset) || Math.abs(offset) > 14 * 60) return json({ error: "offset_min must be whole minutes within ±14 h" }, 400);
  if (!Array.isArray(body.rows)) return json({ error: "rows must be an array" }, 400);
  if (body.rows.length > MAX_ROWS) return json({ error: `At most ${MAX_ROWS} rows per request` }, 413);

  const rows: NewsEventImportRow[] = [];
  const errors = new Map<string, number>();
  const skipped = { currency: 0, impact: 0 };
  for (const raw of body.rows) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) { errors.set("not an object", (errors.get("not an object") ?? 0) + 1); continue; }
    const clean = cleanRecordFromMt5(raw as Mt5RawValue, offset);
    const mapped = "error" in clean ? clean : calendarRowFromCsv(clean.record);
    if ("error" in mapped) { errors.set(mapped.error, (errors.get(mapped.error) ?? 0) + 1); continue; }
    const row = mapped.row;
    if (!row.currency || !WANTED.has(row.currency)) { skipped.currency++; continue; }
    if (row.impact === "low" || row.impact === "none") { skipped.impact++; continue; }
    rows.push(row);
  }
  // One row per value id (the last one wins, as in the import RPC).
  const unique = [...new Map(rows.map(row => [row.external_id, row])).values()];

  const db = createServerSupabase();
  const suspect = await flagSuspectForecasts(db, unique);
  if (suspect instanceof Response) return suspect;

  const totals = { inserted: 0, updated: 0, unchanged: 0 };
  for (let i = 0; i < unique.length; i += RPC_BATCH) {
    const { data, error } = await db.rpc("import_news_events", { p_rows: unique.slice(i, i + RPC_BATCH) });
    if (error) {
      console.error("POST /api/economic-calendar/sync import error:", error);
      return json({ error: "Import failed", written: totals }, 500);
    }
    const result = (Array.isArray(data) ? data[0] : data) as { inserted: number; updated: number; unchanged: number } | null;
    totals.inserted += result?.inserted ?? 0;
    totals.updated += result?.updated ?? 0;
    totals.unchanged += result?.unchanged ?? 0;
  }
  return json({ received: body.rows.length, ...totals, skipped, invalid: Object.fromEntries(errors), suspect });
}

type Db = ReturnType<typeof createServerSupabase>;

/**
 * Sets forecast_suspect on incoming rows with the same rule as the CSV cleaner, using the series'
 * actuals from the database plus the incoming values. A flag already stored is never cleared.
 */
async function flagSuspectForecasts(db: Db, rows: NewsEventImportRow[]): Promise<number | Response> {
  const withForecast = rows.filter(row => row.forecast_value !== null && row.source_series_id);
  if (!withForecast.length) return 0;
  const seriesIds = [...new Set(withForecast.map(row => row.source_series_id as string))];

  // The cleaner used the whole history; the last few years give the same scale and keep the request fast.
  const since = new Date(Date.now() - HISTORY_YEARS * 365.25 * 86_400_000).toISOString();
  const history = new Map<string, Map<string, { time: string; actual: number }>>();
  let read = 0;
  for (const ids of chunks(seriesIds, ID_CHUNK)) {
    for (let offset = 0; read < MAX_HISTORY_ROWS; offset += PAGE) {
      const { data, error } = await db
        .from("news_events")
        .select("external_id, source_series_id, event_time, actual_value")
        .eq("source", "mt5")
        .in("source_series_id", ids)
        .not("actual_value", "is", null)
        .gte("event_time", since)
        .order("event_time", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (error) {
        console.error("POST /api/economic-calendar/sync history error:", error);
        return json({ error: "Failed to read calendar history" }, 500);
      }
      read += data?.length ?? 0;
      for (const item of data ?? []) {
        const series = history.get(item.source_series_id) ?? new Map();
        series.set(item.external_id, { time: item.event_time, actual: Number(item.actual_value) });
        history.set(item.source_series_id, series);
      }
      if (!data || data.length < PAGE) break;
    }
  }
  for (const row of rows) {
    if (row.actual_value === null || !row.source_series_id) continue;
    const series = history.get(row.source_series_id) ?? new Map();
    series.set(row.external_id, { time: row.event_time, actual: row.actual_value });
    history.set(row.source_series_id, series);
  }

  const keep = new Set<string>();
  for (const ids of chunks(withForecast.map(row => row.external_id), ID_CHUNK)) {
    const { data: flagged, error } = await db.from("news_events").select("external_id").eq("source", "mt5").eq("forecast_suspect", true).in("external_id", ids);
    if (error) {
      console.error("POST /api/economic-calendar/sync flags error:", error);
      return json({ error: "Failed to read calendar flags" }, 500);
    }
    for (const item of flagged ?? []) keep.add(item.external_id as string);
  }

  let count = 0;
  for (const row of withForecast) {
    const actuals = [...(history.get(row.source_series_id as string)?.values() ?? [])]
      .sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
      .map(item => item.actual)
      .filter(Number.isFinite);
    row.forecast_suspect = keep.has(row.external_id) || forecastLooksSuspect(row.forecast_value, row.previous_value, row.actual_value, actuals);
    if (row.forecast_suspect) count++;
  }
  return count;
}
