import { NextRequest, NextResponse } from "next/server";
import { ownerOnly, resolvePrivateOwner } from "@/lib/supabase/private-owner";
import { fetchMarketQuotes } from "@/lib/market/market-live";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const context = await resolvePrivateOwner(request);
  if (context instanceof Response) return context;
  const closed = ownerOnly(context);
  if (closed) return closed;
  const raw = request.nextUrl.searchParams.get("symbols");
  const symbols = raw?.split(",").map((value) => value.trim()).filter(Boolean);
  const quotes = await fetchMarketQuotes(symbols);
  return NextResponse.json({ quotes, generatedAt: Date.now() }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
