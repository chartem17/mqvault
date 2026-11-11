import { NextResponse } from "next/server";
import { resolvePrivateOwner } from "@/lib/supabase/private-owner";

export const dynamic = "force-dynamic";

/** The shared list of tradable symbols (reference data, the same for every signed-in user). */
export async function GET(request: Request) {
  const context = await resolvePrivateOwner(request);
  if (context instanceof Response) return context;
  const supabase = context.db;
  const { data, error } = await supabase
    .from("market_instruments")
    .select(
      "symbol, display_symbol, market, asset_class, provider, provider_symbol",
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("symbol", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to load instruments" }, { status: 500 });
  }

  const instruments = (data ?? []).map((row) => ({
    symbol: row.symbol,
    displaySymbol: row.display_symbol,
    market: row.market,
    assetClass: row.asset_class,
    provider: row.provider,
    providerSymbol: row.provider_symbol,
  }));

  return NextResponse.json({ instruments });
}
