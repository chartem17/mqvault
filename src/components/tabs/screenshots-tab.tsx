"use client";
import { useMemo, useState } from "react";
import { useTrades } from "@/hooks/use-trades";
import { ExternalLink, ImageOff, Search, X, TrendingUp, TrendingDown } from "lucide-react";
import { fmt } from "@/lib/utils-trade";

export function ScreenshotsTab() {
  const { trades } = useTrades();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<(typeof tradesWithScreens)[0] | null>(null);

  const tradesWithScreens = useMemo(
    () => trades.filter(t => t.screenshot_url).sort((a, b) => (b.opened_at ?? "").localeCompare(a.opened_at ?? "")),
    [trades]
  );

  const filtered = useMemo(() => {
    if (!search) return tradesWithScreens;
    const q = search.toLowerCase();
    return tradesWithScreens.filter(t =>
      `${t.symbol} ${(t.opened_at ?? "").slice(0, 10)} ${t.setup} ${t.notes} ${t.entry_reason}`.toLowerCase().includes(q)
    );
  }, [tradesWithScreens, search]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Скріншоти угод</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{tradesWithScreens.length} угод зі скріншотами</p>
        </div>
        <div className="flex items-center gap-2 bg-secondary/60 border border-border rounded-lg px-3 py-1.5">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <input
            placeholder="Пошук пари, дати…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-sm text-foreground placeholder-muted-foreground focus:outline-none w-40"
          />
          {search && <button onClick={() => setSearch("")}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <ImageOff className="w-10 h-10 text-muted-foreground/30" />
          <p className="text-sm">Скріншотів не знайдено</p>
          <p className="text-xs text-muted-foreground/60">Додай URL скріншота в журналі угод</p>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(t => (
          <div key={t.id}
            className="bg-card rounded-xl border border-border overflow-hidden group hover:border-primary/40 transition-all cursor-pointer"
            onClick={() => setSelected(t)}
          >
            {/* Preview placeholder + link */}
            <div className="relative bg-secondary/40 h-36 flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-1">
                  <div className="w-10 h-10 rounded-lg bg-secondary/80 flex items-center justify-center mx-auto">
                    <ExternalLink className="w-4 h-4 text-muted-foreground/60" />
                  </div>
                  <p className="text-[10px] text-muted-foreground">TradingView Screenshot</p>
                </div>
              </div>
              {/* Watermark */}
              <div className="absolute top-2 right-2">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${t.net_pnl > 0 ? "bg-green-500/20 text-green-400" : t.net_pnl < 0 ? "bg-red-500/20 text-red-400" : "bg-muted/60 text-muted-foreground"}`}>
                  {t.net_pnl > 0 ? "✓ WIN" : t.net_pnl < 0 ? "✗ LOSS" : "BE"}
                </span>
              </div>
              <div className="absolute bottom-2 left-2">
                <span className="text-[10px] font-mono bg-black/50 text-white px-1.5 py-0.5 rounded">{t.symbol}</span>
              </div>
            </div>

            {/* Card info */}
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-foreground">{t.symbol}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${t.direction === "Long" ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500"}`}>
                    {t.direction}
                  </span>
                </div>
                <span className={`text-sm font-bold tabular-nums font-mono ${t.net_pnl > 0 ? "text-[var(--color-green)]" : t.net_pnl < 0 ? "text-[var(--color-red)]" : "text-muted-foreground"}`}>
                  {fmt.usd(t.net_pnl)}
                </span>
              </div>

              <div className="flex gap-3 text-[10px] text-muted-foreground">
                <span>{(t.opened_at ?? "").slice(0, 10)}</span>
                <span>{t.session}</span>
                {t.setup && <span className="text-primary">{t.setup}</span>}
              </div>

              {t.entry_reason && (
                <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">{t.entry_reason}</p>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-muted-foreground">{fmt.r(t.result_r)}</span>
                <a href={t.screenshot_url ?? undefined} target="_blank" rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="flex items-center gap-1 text-[10px] text-primary hover:underline">
                  TradingView <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setSelected(null)}>
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-base">{selected.symbol}</span>
                <span className={`text-xs px-2 py-0.5 rounded font-semibold ${selected.direction === "Long" ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500"}`}>
                  {selected.direction}
                </span>
                <span className="text-xs text-muted-foreground">{(selected.opened_at ?? "").slice(0, 10)}</span>
              </div>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground transition-colors text-sm">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-3 text-xs">
                {[
                  ["Entry", selected.entry_price],
                  ["Stop", selected.stop_loss],
                  ["TP", selected.take_profit],
                  ["Exit", selected.exit_price],
                  ["P&L", fmt.usd(selected.net_pnl)],
                  ["R", fmt.r(selected.result_r)],
                ].map(([l, v]) => (
                  <div key={l} className="bg-secondary/50 rounded-lg p-2.5">
                    <p className="text-muted-foreground uppercase tracking-wider text-[10px]">{l}</p>
                    <p className="font-mono font-semibold mt-0.5 text-foreground">{v}</p>
                  </div>
                ))}
              </div>
              {selected.entry_reason && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Причина входу</p>
                  <p className="text-sm text-foreground">{selected.entry_reason}</p>
                </div>
              )}
              {selected.mistake && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <p className="text-[10px] text-red-400 uppercase tracking-wider mb-1">Помилка</p>
                  <p className="text-sm text-foreground">{selected.mistake}</p>
                </div>
              )}
              {selected.notes && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Нотатки</p>
                  <p className="text-sm text-foreground">{selected.notes}</p>
                </div>
              )}
              <a href={selected.screenshot_url ?? undefined} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
                <ExternalLink className="w-4 h-4" />
                Відкрити скріншот на TradingView
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}