import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const DAY = 86_400_000;

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const from = new Date(sp.get("from") ?? Date.now() - 7 * DAY);
    const to = new Date(sp.get("to") ?? Date.now() + 14 * DAY);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json(
        { error: "Invalid date range" },
        { status: 400 },
      );
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
      return NextResponse.json(
        { error: "Failed to fetch news" },
        { status: 500 },
      );
    }

    const events = data ?? [];
    const linked = new Map<string, number>();
    if (events.length) {
      const { data: links } = await supabase
        .from("trade_news_links")
        .select("news_event_id")
        .in(
          "news_event_id",
          events.map((e) => e.id),
        );
      for (const l of links ?? []) {
        linked.set(l.news_event_id, (linked.get(l.news_event_id) ?? 0) + 1);
      }
    }

    return NextResponse.json({
      data: events.map((e) => ({
        ...e,
        impact: String(e.impact ?? "").toLowerCase(),
        linked_trades: linked.get(e.id) ?? 0,
      })),
    });
  } catch (error) {
    console.error("GET /news unexpected error:", error);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 },
    );
  }
}
