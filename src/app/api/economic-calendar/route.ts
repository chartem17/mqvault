import { NextResponse } from "next/server";
import { ownerOnly, resolveUser } from "@/lib/auth/current-user";
import { currenciesFromTrades, parseCalendarQuery, toCalendarEvent, type NewsEventRecord } from "@/lib/news/economic-calendar";

export const dynamic = "force-dynamic";
const MAX_EVENTS = 2000;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * GET /api/economic-calendar?from=<ISO>&to=<ISO>&currencies=USD,EUR&impact=high,medium&scope=mine|all
 * Site-wide MT5 calendar (news_events, source = 'mt5'). Times are UTC instants; the client shows them
 * in the user's timezone (ADR 0001). scope=mine (default) keeps only currencies of the owner's traded
 * pairs; when there are no trades yet, all calendar currencies are returned.
 */
export async function GET(request: Request) {
  const context = await resolveUser(request);
  if (context instanceof Response) return context;
  const closed = ownerOnly(context);
  if (closed) return closed;
  const { db, ownerId } = context;

  const params = new URL(request.url).searchParams;
  const parsed = parseCalendarQuery(params);
  if ("error" in parsed) return json({ error: parsed.error }, 400);
  const { query } = parsed;
  const scope = params.get("scope") === "all" ? "all" : "mine";

  let currencies = query.currencies;
  let tradedCurrencies: string[] = [];
  if (scope === "mine") {
    const { data: trades, error } = await db.from("journal_trades").select("symbol, base_asset, quote_asset").eq("user_id", ownerId).limit(20000);
    if (error) return json({ error: "Failed to read trades" }, 500);
    tradedCurrencies = currenciesFromTrades(trades ?? []);
    if (tradedCurrencies.length) currencies = currencies ? currencies.filter(c => tradedCurrencies.includes(c)) : tradedCurrencies;
  }

  let request_ = db
    .from("news_events")
    .select("id, title, country, currency, impact, event_time, actual, forecast, previous, event_type, all_day, tentative, actual_value, forecast_value, forecast_suspect, source")
    .eq("source", "mt5")
    .in("impact", query.impacts)
    .gte("event_time", query.from.toISOString())
    .lt("event_time", query.to.toISOString())
    .order("event_time", { ascending: true })
    .limit(MAX_EVENTS + 1);
  if (currencies) {
    if (!currencies.length) return json({ events: [], currencies: [], tradedCurrencies, truncated: false });
    request_ = request_.in("currency", currencies);
  }
  const { data, error } = await request_;
  if (error) {
    console.error("GET /api/economic-calendar error:", error);
    return json({ error: "Failed to fetch calendar" }, 500);
  }

  const rows = (data ?? []) as NewsEventRecord[];
  return json({
    events: rows.slice(0, MAX_EVENTS).map(toCalendarEvent),
    currencies: currencies ?? null,
    tradedCurrencies,
    truncated: rows.length > MAX_EVENTS,
  });
}
