import type { Instrument } from "@/lib/instruments";

const MARKET_ORDER = [
  "Forex",
  "Crypto",
  "Commodities",
  "Energy",
  "Index",
  "Stocks",
];

export function marketsFrom(
  values: Array<string | null | undefined>,
): string[] {
  const unique = Array.from(new Set(values.filter((v): v is string => !!v)));
  return unique.sort((a, b) => {
    const ia = MARKET_ORDER.indexOf(a);
    const ib = MARKET_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

export function sortBySymbol(list: Instrument[]): Instrument[] {
  return [...list].sort((a, b) =>
    a.symbol.localeCompare(b.symbol, "en", { sensitivity: "base" }),
  );
}
