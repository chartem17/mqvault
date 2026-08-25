"use client";
import { useState } from "react";
import { SectionHeader } from "@/components/ui/section-header";
import { ExternalLink, Globe2, TrendingUp, AlertTriangle, Newspaper, RefreshCw } from "lucide-react";

type NewsCategory = "geopolitics" | "macro" | "forex" | "crypto";

const NEWS_SOURCES: {
  id: NewsCategory;
  label: string;
  icon: React.ElementType;
  color: string;
  description: string;
  links: { label: string; url: string }[];
}[] = [
  {
    id: "geopolitics",
    label: "Геополітика",
    icon: Globe2,
    color: "text-red-400",
    description: "Reuters World, AP News, Al Jazeera — live оновлення",
    links: [
      { label: "Reuters World", url: "https://www.reuters.com/world/" },
      { label: "AP News World", url: "https://apnews.com/world-news" },
      { label: "Al Jazeera", url: "https://www.aljazeera.com/news/" },
      { label: "BBC News", url: "https://www.bbc.com/news/world" },
    ],
  },
  {
    id: "macro",
    label: "Макро / ЦБ",
    icon: TrendingUp,
    color: "text-yellow-400",
    description: "Bloomberg, Reuters Business, FT",
    links: [
      { label: "Reuters Business", url: "https://www.reuters.com/business/" },
      { label: "Bloomberg Markets", url: "https://www.bloomberg.com/markets" },
      { label: "MarketWatch", url: "https://www.marketwatch.com/" },
      { label: "FXStreet Economic", url: "https://www.fxstreet.com/economic-calendar" },
    ],
  },
  {
    id: "forex",
    label: "Форекс",
    icon: AlertTriangle,
    color: "text-primary",
    description: "FXStreet, DailyFX, Forex Factory",
    links: [
      { label: "FXStreet News", url: "https://www.fxstreet.com/news" },
      { label: "DailyFX", url: "https://www.dailyfx.com/" },
      { label: "Forex Factory News", url: "https://www.forexfactory.com/news" },
      { label: "Investing.com Forex", url: "https://www.investing.com/news/forex-news" },
    ],
  },
  {
    id: "crypto",
    label: "Крипто",
    icon: Newspaper,
    color: "text-purple-400",
    description: "CoinDesk, CryptoNews, Decrypt",
    links: [
      { label: "CoinDesk", url: "https://www.coindesk.com/news/" },
      { label: "CryptoNews", url: "https://cryptonews.com/" },
      { label: "Decrypt", url: "https://decrypt.co/" },
      { label: "CoinTelegraph", url: "https://cointelegraph.com/" },
    ],
  },
];

// Iframe sources for each category
const IFRAME_SOURCES: Record<NewsCategory, string> = {
  geopolitics: "https://www.reuters.com/world/",
  macro: "https://www.reuters.com/business/",
  forex: "https://www.fxstreet.com/news",
  crypto: "https://coindesk.com/news/",
};

const STATIC_NEWS: { cat: NewsCategory; time: string; headline: string; source: string; url: string; tags: string[] }[] = [
  { cat: "geopolitics", time: "22:14", headline: "Ukraine peace talks stall as frontline situation escalates — EU calls emergency session", source: "Reuters", url: "https://www.reuters.com/world/", tags: ["UA","EU","NATO"] },
  { cat: "geopolitics", time: "21:30", headline: "Israel-Hezbollah ceasefire monitoring framework enters 3rd week amid fragile calm", source: "Al Jazeera", url: "https://www.aljazeera.com/news/", tags: ["ME","Ceasefire"] },
  { cat: "geopolitics", time: "19:55", headline: "China conducts live-fire naval drills in South China Sea near Taiwan Strait", source: "AP News", url: "https://apnews.com/world-news", tags: ["CN","TW","Pacific"] },
  { cat: "macro", time: "22:00", headline: "Fed's Powell: Rate path dependent on inflation data; July cut 'not off the table'", source: "Bloomberg", url: "https://www.bloomberg.com/markets", tags: ["Fed","USD","Rates"] },
  { cat: "macro", time: "20:30", headline: "ECB minutes show split on pace of easing; EUR/USD climbs to 6-week high", source: "Reuters", url: "https://www.reuters.com/business/", tags: ["ECB","EUR"] },
  { cat: "macro", time: "18:10", headline: "UK GDP Q1 2026 revised up to 0.7% QoQ; GBP surges 0.4% against USD", source: "FT", url: "https://www.ft.com/", tags: ["UK","GBP"] },
  { cat: "forex", time: "21:45", headline: "EUR/USD eyes 1.1400 resistance — DXY weakness extends as risk-on dominates", source: "FXStreet", url: "https://www.fxstreet.com/news", tags: ["EURUSD","DXY"] },
  { cat: "forex", time: "20:00", headline: "GBP/USD consolidates near 1.3500 ahead of UK manufacturing data release", source: "DailyFX", url: "https://www.dailyfx.com/", tags: ["GBPUSD"] },
  { cat: "forex", time: "17:30", headline: "XAU/USD breaks $3,350 — safe-haven demand rises on geopolitical tensions", source: "Investing.com", url: "https://www.investing.com/news/forex-news", tags: ["Gold","XAU"] },
  { cat: "crypto", time: "22:30", headline: "Bitcoin holds $105K support as ETF inflows hit $800M — analysts eye $115K target", source: "CoinDesk", url: "https://www.coindesk.com/news/", tags: ["BTC","ETF"] },
  { cat: "crypto", time: "21:15", headline: "Ethereum whale accumulation detected — $2.4B moved to cold wallets ahead of Cancun 2", source: "CryptoNews", url: "https://cryptonews.com/", tags: ["ETH","Whales"] },
  { cat: "crypto", time: "19:00", headline: "SEC approves spot Solana ETF filing — SOL jumps 12% in pre-market", source: "Decrypt", url: "https://decrypt.co/", tags: ["SOL","ETF","SEC"] },
];

export function NewsTab() {
  const [activeCategory, setActiveCategory] = useState<NewsCategory | "all">("all");
  const [showIframe, setShowIframe] = useState(false);
  const [iframeSrc, setIframeSrc] = useState("");

  const filtered = activeCategory === "all"
    ? STATIC_NEWS
    : STATIC_NEWS.filter(n => n.cat === activeCategory);

  function openLive(cat: NewsCategory) {
    setIframeSrc(IFRAME_SOURCES[cat]);
    setShowIframe(true);
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Новини & Геополітика</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Live стрічка · Геополітика · Макро · Forex · Crypto</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[10px] text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full border border-green-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
            Live
          </div>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setActiveCategory("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${activeCategory === "all" ? "bg-primary/10 text-primary border-primary/20" : "bg-secondary/60 text-muted-foreground border-border hover:text-foreground"}`}>
          Всі
        </button>
        {NEWS_SOURCES.map(s => {
          const Icon = s.icon;
          return (
            <button key={s.id} onClick={() => setActiveCategory(s.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${activeCategory === s.id ? "bg-primary/10 text-primary border-primary/20" : "bg-secondary/60 text-muted-foreground border-border hover:text-foreground"}`}>
              <Icon className={`w-3.5 h-3.5 ${s.color}`} />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Source cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {NEWS_SOURCES.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.id} className="bg-card rounded-xl border border-border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${s.color}`} />
                <span className="text-xs font-semibold text-foreground">{s.label}</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">{s.description}</p>
              <div className="space-y-1">
                {s.links.map(l => (
                  <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[10px] text-primary hover:underline">
                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                    {l.label}
                  </a>
                ))}
              </div>
              <button onClick={() => openLive(s.id)}
                className="w-full text-[10px] py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium">
                Відкрити live ↗
              </button>
            </div>
          );
        })}
      </div>

      {/* News feed */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <SectionHeader title="Стрічка новин" sub={`${filtered.length} публікацій`} />
          <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Оновити
          </button>
        </div>
        <div className="space-y-0">
          {filtered.map((n, i) => {
            const src = NEWS_SOURCES.find(s => s.id === n.cat);
            const Icon = src?.icon || Newspaper;
            return (
              <div key={i} className="flex items-start gap-3 py-3 border-b border-border/40 last:border-0 group">
                <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${src?.color || "text-muted-foreground"}`} />
                <div className="flex-1 min-w-0">
                  <a href={n.url} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-2">
                    {n.headline}
                  </a>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[10px] text-muted-foreground">{n.source}</span>
                    <span className="text-[10px] text-muted-foreground">·</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{n.time}</span>
                    {n.tags.map(t => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 bg-secondary rounded text-muted-foreground">{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live iframe panel */}
      {showIframe && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-medium text-foreground">Live джерело</span>
            <div className="flex items-center gap-2">
              <a href={iframeSrc} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline">
                Відкрити в новій вкладці <ExternalLink className="w-3 h-3" />
              </a>
              <button onClick={() => setShowIframe(false)} className="text-muted-foreground hover:text-foreground text-xs px-2 py-1 rounded-md border border-border transition-colors">
                Закрити
              </button>
            </div>
          </div>
          <div style={{ height: 500 }}>
            <iframe src={iframeSrc} className="w-full h-full border-none" title="Live news" loading="lazy" />
          </div>
        </div>
      )}
    </div>
  );
}