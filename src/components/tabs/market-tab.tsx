"use client";
import { useMemo, useState } from "react";
import { Activity, AlertCircle, CandlestickChart, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { MARKET_WATCHLIST } from "@/lib/market-watchlist";
import { useMarketQuotes } from "@/hooks/use-market-quotes";
import type { MarketQuote } from "@/lib/market-types";

const POS = "var(--color-green)";
const NEG = "var(--color-red)";
const allSymbols = MARKET_WATCHLIST.map((item) => item.symbol);
const formatPrice = (quote: MarketQuote) => {
  if (quote.price === null) return "—";
  if (quote.symbol === "BTCUSDT") return quote.price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (["ETHUSDT", "SOLUSDT", "XAUUSD"].includes(quote.symbol)) return quote.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (quote.symbol === "XAGUSD") return quote.price.toFixed(3);
  if (quote.symbol === "US30") return quote.price.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return quote.price.toFixed(5);
};
const formatPercent = (value: number | null) => value === null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
const formatTime = (timestamp: number | null) => timestamp ? new Intl.DateTimeFormat("uk-UA", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(timestamp) : "—";

export function MarketTab() {
  const { quotes, state, updatedAt, refresh } = useMarketQuotes(allSymbols, 60_000);;
  const [selected, setSelected] = useState("XAUUSD");
  const quoteBySymbol = useMemo(() => new Map(quotes.map((quote) => [quote.symbol, quote])), [quotes]);
  const rows = MARKET_WATCHLIST.map((instrument) => quoteBySymbol.get(instrument.symbol) ?? ({ ...instrument, price: null, previousClose: null, changePercent: null, high: null, low: null, marketState: "unknown", delayed: false, updatedAt: null, error: "Waiting for API response" } satisfies MarketQuote));
  const selectedQuote = rows.find((row) => row.symbol === selected) ?? rows[0];
  const valid = rows.filter((row) => row.changePercent !== null);
  const strongest = [...valid].sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0))[0];
  const weakest = [...valid].sort((a, b) => (a.changePercent ?? 0) - (b.changePercent ?? 0))[0];
  const sourceLabel = state === "ready" ? "All feeds healthy" : state === "degraded" ? "Some feeds unavailable" : state === "error" ? "Feed unavailable" : "Loading market feeds";

  return <div className="p-6 space-y-6">
    <div className="flex items-end justify-between gap-4 flex-wrap">
      <div><h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Market</h1><p className="text-xs text-muted-foreground mt-1">Only provider responses are shown. Missing data is displayed as —, never replaced with demo values.</p></div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground"><span>{sourceLabel} · updated {formatTime(updatedAt)}</span><button onClick={refresh} className="rounded-lg border border-border p-2 hover:bg-secondary" aria-label="Refresh quotes"><RefreshCw className="w-4 h-4" /></button></div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Pulse label="Strongest today" value={strongest?.displaySymbol ?? "—"} meta={formatPercent(strongest?.changePercent ?? null)} icon={<TrendingUp className="w-4 h-4" />} color={POS} />
      <Pulse label="Weakest today" value={weakest?.displaySymbol ?? "—"} meta={formatPercent(weakest?.changePercent ?? null)} icon={<TrendingDown className="w-4 h-4" />} color={NEG} />
      <Pulse label="Live instruments" value={`${rows.filter((row) => row.price !== null).length}/${rows.length}`} meta="Provider-backed quotes" icon={<Activity className="w-4 h-4" />} color="var(--color-primary)" />
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.7fr] gap-5">
      <section className="rounded-2xl border border-border bg-card p-4 overflow-x-auto"><div className="mb-4"><h2 className="text-sm font-semibold">Watchlist</h2><p className="text-xs text-muted-foreground mt-1">Price, day range and daily change from Binance or Twelve Data.</p></div><table className="w-full text-xs"><thead><tr className="border-b border-border">{["Asset", "Market", "Last", "24h", "High", "Low", "State", "Source"].map((heading) => <th key={heading} className="px-3 py-2 text-left uppercase tracking-wider text-muted-foreground whitespace-nowrap">{heading}</th>)}</tr></thead><tbody>{rows.map((row) => { const change = row.changePercent; const color = change === null ? "var(--muted-foreground)" : change >= 0 ? POS : NEG; return <tr key={row.symbol} onClick={() => setSelected(row.symbol)} className={`cursor-pointer border-b border-border/50 hover:bg-secondary/30 ${selected === row.symbol ? "bg-primary/5" : ""}`}><td className="px-3 py-3 font-semibold">{row.displaySymbol}</td><td className="px-3 py-3 text-muted-foreground">{row.market}</td><td className="px-3 py-3 font-mono">{formatPrice(row)}</td><td className="px-3 py-3 font-mono" style={{ color }}>{formatPercent(change)}</td><td className="px-3 py-3 font-mono">{row.high === null ? "—" : formatPrice({ ...row, price: row.high })}</td><td className="px-3 py-3 font-mono">{row.low === null ? "—" : formatPrice({ ...row, price: row.low })}</td><td className="px-3 py-3 capitalize text-muted-foreground">{row.marketState}</td><td className="px-3 py-3 text-muted-foreground">{row.provider}</td></tr>; })}</tbody></table></section>
      <section className="rounded-2xl border border-border bg-card p-4"><div className="mb-4"><h2 className="text-sm font-semibold flex items-center gap-2"><CandlestickChart className="w-4 h-4 text-primary" />Selected asset</h2><p className="text-xs text-muted-foreground mt-1">No derived signals or fabricated chart data.</p></div><div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-4"><div className="flex justify-between gap-3"><div><div className="text-lg font-semibold">{selectedQuote.displaySymbol}</div><div className="text-xs text-muted-foreground mt-1">{selectedQuote.market} · {selectedQuote.provider}</div></div><div className="text-right"><div className="font-mono text-lg">{formatPrice(selectedQuote)}</div><div className="font-mono text-sm" style={{ color: (selectedQuote.changePercent ?? 0) >= 0 ? POS : NEG }}>{formatPercent(selectedQuote.changePercent)}</div></div></div><div className="grid grid-cols-2 gap-3"><Metric label="Previous close" value={selectedQuote.previousClose === null ? "—" : formatPrice({ ...selectedQuote, price: selectedQuote.previousClose })} /><Metric label="Updated" value={formatTime(selectedQuote.updatedAt)} /><Metric label="Day high" value={selectedQuote.high === null ? "—" : formatPrice({ ...selectedQuote, price: selectedQuote.high })} /><Metric label="Day low" value={selectedQuote.low === null ? "—" : formatPrice({ ...selectedQuote, price: selectedQuote.low })} /></div>{selectedQuote.error && <div className="flex gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400"><AlertCircle className="w-4 h-4 shrink-0" />{selectedQuote.error}</div>}</div></section>
    </div>
  </div>;
}
function Pulse({ label, value, meta, icon, color }: { label: string; value: string; meta: string; icon: React.ReactNode; color: string }) { return <div className="rounded-2xl border border-border bg-card p-4"><div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground"><span style={{ color }}>{icon}</span>{label}</div><div className="mt-3 text-lg font-semibold">{value}</div><div className="mt-1 text-xs font-mono" style={{ color }}>{meta}</div></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-border bg-background/40 p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div><div className="mt-1 font-mono text-sm">{value}</div></div>; }
