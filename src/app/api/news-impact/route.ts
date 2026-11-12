import { NextResponse } from "next/server";
import { resolveUser } from "@/lib/auth/current-user";
import { newsCurrenciesForSymbol, newsImpactReport, summarizeTradesNews, NEWS_NEAR_MINUTES, NEWS_RULE_HORIZON_MINUTES, NEWS_WIDE_MINUTES, type NewsEventInput, type NewsTradeInput } from "@/lib/news/news-trades";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE = 1000;
const MAX_EVENTS = 50_000;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * GET /api/news-impact?account_id=<uuid>&from=<ISO>&to=<ISO>
 * Links the owner's trades (opened in [from, to), optional account) to high/medium MT5 calendar
 * releases of their currencies, on the fly (ADR 0014). Returns per-trade buckets, tags and the nearest
 * red release (for the Strategy Control rule), plus near/around/clear statistics with n.
 */
export async function GET(request: Request) {
  const context = await resolveUser(request);
  if (context instanceof Response) return context;
  // Closed beta: the calendar is licensed for the owner's private use (ADR 0013), so other users get
  // "not checked" (no coverage) — the same shape the client already handles when the calendar is empty.
  if (!context.isOwner) return json({ trades: [], coverage: null });
  const { db, ownerId } = context;

  const params = new URL(request.url).searchParams;
  const accountId = params.get("account_id");
  if (accountId && !UUID.test(accountId)) return json({ error: "Invalid account_id" }, 400);
  const from = params.get("from") ? new Date(params.get("from") as string) : null;
  const to = params.get("to") ? new Date(params.get("to") as string) : null;
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) return json({ error: "Invalid date range" }, 400);

  let tradesQuery = db
    .from("journal_trades")
    .select("id, account_id, symbol, base_asset, quote_asset, opened_at, closed_at, net_pnl, result_r")
    .eq("user_id", ownerId)
    .order("opened_at", { ascending: true })
    .limit(20000);
  if (accountId) tradesQuery = tradesQuery.eq("account_id", accountId);
  if (from) tradesQuery = tradesQuery.gte("opened_at", from.toISOString());
  if (to) tradesQuery = tradesQuery.lt("opened_at", to.toISOString());
  const { data: tradeRows, error: tradesError } = await tradesQuery;
  if (tradesError) return json({ error: "Failed to read trades" }, 500);
  const trades = (tradeRows ?? []) as (NewsTradeInput & { account_id: string })[];

  const windows = { nearMinutes: NEWS_NEAR_MINUTES, wideMinutes: NEWS_WIDE_MINUTES, ruleHorizonMinutes: NEWS_RULE_HORIZON_MINUTES };
  const currencies = [...new Set(trades.flatMap(t => newsCurrenciesForSymbol(t.symbol, t.base_asset, t.quote_asset)))];
  const times = trades.flatMap(t => [Date.parse(t.opened_at), t.closed_at ? Date.parse(t.closed_at) : NaN]).filter(Number.isFinite);

  const events: NewsEventInput[] = [];
  if (currencies.length && times.length) {
    const pad = Math.max(NEWS_WIDE_MINUTES, NEWS_RULE_HORIZON_MINUTES) * 60_000;
    const start = new Date(Math.min(...times) - pad).toISOString();
    const end = new Date(Math.max(...times) + pad).toISOString();
    for (let offset = 0; offset < MAX_EVENTS; offset += PAGE) {
      const { data, error } = await db
        .from("news_events")
        .select("id, title, event_code, currency, impact, event_time, all_day, event_type")
        .eq("source", "mt5")
        .in("impact", ["high", "medium"])
        .in("currency", currencies)
        .eq("all_day", false)
        .gte("event_time", start)
        .lte("event_time", end)
        .order("event_time", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (error) {
        console.error("GET /api/news-impact events error:", error);
        return json({ error: "Failed to read calendar" }, 500);
      }
      events.push(...((data ?? []) as NewsEventInput[]));
      if (!data || data.length < PAGE) break;
    }
  }

  const summaries = summarizeTradesNews(trades, events);
  const coverage = events.length ? { from: events[0].event_time, to: events[events.length - 1].event_time, events: events.length } : null;
  return json({
    windows,
    coverage,
    report: newsImpactReport(trades, summaries),
    trades: summaries.map(s => ({ ...s, links: s.links.filter(l => l.relation !== "within_2h" || l.impact === "high") })),
  });
}
