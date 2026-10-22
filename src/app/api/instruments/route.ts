import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("market_instruments")
    .select(
      "symbol, display_symbol, market, asset_class, provider, provider_symbol",
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("symbol", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
