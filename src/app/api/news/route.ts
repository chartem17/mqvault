import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;

function parseDate(value: string | null, fallback: number) {
  const date = new Date(value ?? fallback);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const from = parseDate(params.get("from"), Date.now() - 7 * DAY);
    const to = parseDate(params.get("to"), Date.now() + 14 * DAY);
    if (!from || !to) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }

    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("news_events")
      .select(
        "id, title, country, currency, impact, event_time, actual, forecast, previous, unit, source",
      )
      .gte("event_time", from.toISOString())
      .lte("event_time", to.toISOString())
      .order("event_time", { ascending: true })
      .limit(500);

    if (error) {
      console.error("GET /news error:", error);
      return NextResponse.json({ error: "Failed to fetch news" }, { status: 500 });
    }

    const events = data ?? [];
    const linked = new Map<string, number>();

    if (events.length) {
      const { data: links, error: linksError } = await supabase
        .from("trade_news_links")
        .select("news_event_id")
        .in(
          "news_event_id",
          events.map((event) => event.id),
        );

      if (linksError) console.error("GET /news links error:", linksError);
      for (const link of links ?? []) {
        linked.set(link.news_event_id, (linked.get(link.news_event_id) ?? 0) + 1);
      }
    }

    return NextResponse.json({
      data: events.map((event) => ({
        ...event,
        impact: String(event.impact ?? "low").toLowerCase(),
        linked_trades: linked.get(event.id) ?? 0,
      })),
    });
  } catch (error) {
    console.error("GET /news unexpected error:", error);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
