"use client";
import { useState } from "react";
import { SectionHeader } from "@/components/ui/section-header";
import { ExternalLink, RefreshCw, Calendar, Info } from "lucide-react";

const UPCOMING_EVENTS = [
  { time: "12:30", currency: "USD", impact: "high",   event: "Core PCE Price Index (MoM)", forecast: "0.2%", prev: "0.2%" },
  { time: "14:00", currency: "USD", impact: "medium", event: "CB Consumer Confidence",     forecast: "98.5", prev: "98.0" },
  { time: "09:00", currency: "EUR", impact: "medium", event: "German CPI (MoM)",            forecast: "0.1%", prev: "0.0%" },
  { time: "08:30", currency: "GBP", impact: "high",   event: "UK CPI (YoY)",                forecast: "2.2%", prev: "2.3%" },
  { time: "07:45", currency: "EUR", impact: "low",    event: "French Industrial Production", forecast: "0.3%", prev: "-0.5%" },
  { time: "12:30", currency: "CAD", impact: "medium", event: "GDP (MoM)",                   forecast: "0.1%", prev: "0.1%" },
  { time: "18:00", currency: "USD", impact: "high",   event: "FOMC Member Speech",          forecast: "—",    prev: "—" },
  { time: "02:00", currency: "CNY", impact: "high",   event: "Manufacturing PMI",           forecast: "49.8", prev: "49.5" },
  { time: "06:30", currency: "JPY", impact: "medium", event: "Tokyo CPI (YoY)",             forecast: "2.1%", prev: "2.2%" },
  { time: "12:30", currency: "USD", impact: "high",   event: "Initial Jobless Claims",      forecast: "225K",  prev: "222K" },
  { time: "14:00", currency: "USD", impact: "high",   event: "ISM Manufacturing PMI",       forecast: "49.2", prev: "48.7" },
  { time: "12:30", currency: "USD", impact: "high",   event: "Non-Farm Payrolls",           forecast: "175K",  prev: "177K" },
  { time: "12:30", currency: "USD", impact: "high",   event: "Unemployment Rate",           forecast: "4.1%", prev: "4.1%" },
];

const MACRO_INDICATORS = [
  { label: "US CPI (YoY)",        value: "3.3%",   prev: "3.4%",   trend: "down",   note: "Травень 2026" },
  { label: "US Core CPI (YoY)",   value: "3.5%",   prev: "3.6%",   trend: "down",   note: "Травень 2026" },
  { label: "Fed Rate",            value: "4.50%",  prev: "4.75%",  trend: "down",   note: "Червень 2026" },
  { label: "US GDP (QoQ)",        value: "2.1%",   prev: "2.4%",   trend: "down",   note: "Q1 2026" },
  { label: "ISM Manufacturing",   value: "48.7",   prev: "49.2",   trend: "down",   note: "Травень 2026" },
  { label: "NFP",                 value: "177K",   prev: "185K",   trend: "down",   note: "Травень 2026" },
  { label: "Unemployment",        value: "4.1%",   prev: "4.0%",   trend: "up",     note: "Травень 2026" },
  { label: "EUR CPI (Flash YoY)", value: "2.0%",   prev: "2.2%",   trend: "down",   note: "Червень 2026" },
  { label: "ECB Rate",            value: "2.25%",  prev: "2.50%",  trend: "down",   note: "Червень 2026" },
  { label: "UK CPI (YoY)",        value: "2.3%",   prev: "2.6%",   trend: "down",   note: "Травень 2026" },
  { label: "BoE Rate",            value: "4.25%",  prev: "4.50%",  trend: "down",   note: "Травень 2026" },
  { label: "China PMI (Mfg)",     value: "49.5",   prev: "50.4",   trend: "down",   note: "Травень 2026" },
  { label: "US PPI (YoY)",        value: "2.4%",   prev: "2.2%",   trend: "up",     note: "Травень 2026" },
  { label: "Gold Reserves (US)",  value: "8,133t", prev: "8,133t", trend: "neutral",note: "Q1 2026" },
  { label: "DXY Index",           value: "103.2",  prev: "105.4",  trend: "down",   note: "Live est." },
];

const impactColors: Record<string, string> = {
  high:   "bg-red-500/20 text-red-400 border-red-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low:    "bg-muted/50 text-muted-foreground border-border",
};

export function CalendarTab() {
  const [view, setView] = useState<"calendar" | "macro">("calendar");

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Економічний календар</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Макропоказники · Events · ForexFactory-стиль</p>
        </div>
        <div className="flex items-center gap-2">
          {(["calendar","macro"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${view === v ? "bg-primary/10 text-primary border-primary/20" : "bg-secondary/60 text-muted-foreground border-border hover:text-foreground"}`}>
              {v === "calendar" ? "📅 Календар" : "📊 Макро"}
            </button>
          ))}
          <a href="https://www.investing.com/economic-calendar/" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors">
            <ExternalLink className="w-3.5 h-3.5" /> Investing.com
          </a>
        </div>
      </div>

      {view === "calendar" ? (
        <div className="space-y-4">
          {/* Investing.com iframe */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Investing.com Economic Calendar</span>
              </div>
              <a href="https://www.investing.com/economic-calendar/" target="_blank" rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1">
                Відкрити повний <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div style={{ height: 480 }}>
              <iframe
                src="https://sslecal2.investing.com?columns=exc_flags,exc_currency,exc_importance,exc_actual,exc_forecast,exc_previous&features=datepicker,timezone&countries=25,32,6,37,72,22,17,39,14,10,35,43,56&calType=week&timeZone=60&lang=56"
                style={{ width: "100%", height: "100%", border: "none" }}
                title="Economic Calendar"
                loading="lazy"
              />
            </div>
            <div className="px-4 py-2 border-t border-border flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Info className="w-3 h-3" />
              Потрібне інтернет-з'єднання для завантаження календаря від Investing.com
            </div>
          </div>

          {/* Upcoming high-impact */}
          <div className="bg-card rounded-xl border border-border p-4">
            <SectionHeader title="Найближчі ключові події" sub="High & Medium impact events" />
            <div className="space-y-1">
              {UPCOMING_EVENTS.map((ev, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0 text-xs">
                  <span className="font-mono text-muted-foreground w-10 shrink-0">{ev.time}</span>
                  <span className="font-mono font-bold w-8 shrink-0 text-foreground">{ev.currency}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${impactColors[ev.impact]}`}>
                    {ev.impact === "high" ? "●●●" : ev.impact === "medium" ? "●●○" : "●○○"}
                  </span>
                  <span className="flex-1 text-foreground truncate">{ev.event}</span>
                  <span className="text-muted-foreground w-12 text-right shrink-0">
                    <span className="text-foreground font-medium">{ev.forecast}</span>
                  </span>
                  <span className="text-muted-foreground w-12 text-right shrink-0">{ev.prev}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        // Macro indicators grid
        <div className="bg-card rounded-xl border border-border p-4">
          <SectionHeader title="Макроіндикатори" sub="Актуальні дані — стиль ForexFactory" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {MACRO_INDICATORS.map((m, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-secondary/40 rounded-lg border border-border/50 hover:bg-secondary/70 transition-colors">
                <div>
                  <p className="text-xs font-semibold text-foreground">{m.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{m.note}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold tabular-nums font-mono text-foreground">{m.value}</p>
                  <div className="flex items-center gap-1 justify-end mt-0.5">
                    <span className={`text-[10px] font-semibold ${m.trend === "up" ? "text-red-400" : m.trend === "down" ? "text-green-400" : "text-muted-foreground"}`}>
                      {m.trend === "up" ? "▲" : m.trend === "down" ? "▼" : "—"} {m.prev}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}