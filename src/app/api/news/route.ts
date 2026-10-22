import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function fail(status: number, error: string, detail?: string) {
  return NextResponse.json(
    { error, ...(process.env.NODE_ENV !== "production" && detail ? { detail } : {}) },
    { status },
  );
}

function parseDate(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const params = request.nextUrl.searchParams;
    const now = Date.now();
    const from = parseDate(params.get("from"), new Date(now - 7 * 86400000));
    const to = parseDate(params.get("to"), new Date(now + 14 * 86400000));

    const { data: owner, error: ownerError } = await supabase
      .from("app_users")
      .select("id")
      .eq("is_owner", true)
      .limit(1)
      .maybeSingle();
    if (ownerError || !owner?.id) return fail(500, "Owner not found");

    const { data: events, error } = await supabase
      .from("news_events")
      .select("id, title, country, currency, impact, event_time, actual, forecast, previous, unit")
      .gte("event_time", from.toISOString())
      .lte("event_time", to.toISOString())
      .order("event_time", { ascending: true })
      .limit(500);
    if (error) return fail(500, "Failed to fetch news", error.message);

    const ids = (events ?? []).map((e) => e.id);
    const exposure: Record<string, number> = {};

    if (ids.length) {
      const { data: links, error: linkError } = await supabase
        .from("trade_news_links")
        .select("news_event_id, journal_trades!inner(user_id)")
        .in("news_event_id", ids)
        .eq("journal_trades.user_id", owner.id);
      if (linkError) {
        console.error("GET /news links error:", linkError);
      } else {
        for (const link of links ?? []) {
          exposure[link.news_event_id] = (exposure[link.news_event_id] ?? 0) + 1;
        }
      }
    }

    return NextResponse.json({
      data: (events ?? []).map((e) => ({ ...e, linked_trades: exposure[e.id] ?? 0 })),
    });
  } catch (error) {
    console.error("GET /news unexpected error:", error);
    return fail(500, "Unexpected server error");
  }
}
