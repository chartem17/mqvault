"use client";

import { useMemo, useState, useCallback } from "react";
import { Target, ShieldAlert, Wallet, Flag, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { useTrades } from "@/hooks/use-trades";
import { phaseLabel } from "@/lib/account-data";
import { useMt5 } from "@/hooks/use-mt5";
import {
  computeStats,
  computeEquity,
  computeMonthly,
  groupByKey,
  fmt,
} from "@/lib/utils-trade";
import { StatCard } from "@/components/ui/stat-card";
import LightRays from "@/components/ui/light-rays";
import { DrawdownPanel } from "@/components/ui/drawdown-panel";
import { StreakStatCard } from "@/components/ui/streak-stat-card";
import { SectionHeader } from "@/components/ui/section-header";
import { computeAdvancedStats, type RBucket } from "@/lib/advanced-stats";
import { RiskSummary } from "@/components/ui/risk-summary";

type EqPoint = {
  date: string;
  time?: string;
  pair?: string;
  session?: string;
  emotion?: string;
  tradePnl?: number;
  resultR?: number;
  pnl: number;
};

const GREEN = "var(--color-green)";
const RED = "var(--color-red)";
const CARD = "rounded-2xl border border-white/10 bg-background";

function EquityChart({ points, totalPnl }: { points: EqPoint[]; totalPnl: number }) {
  const [hover, setHover] = useState<{ idx: number; px: number; py: number } | null>(null);

  const W = 900;
  const H = 300;
  const PAD_L = 12;
  const PAD_R = 48;
  const PAD_T = 14;
  const PAD_B = 22;

  const eq = points.slice(-120);

  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

 const pnlValues = eq.length > 0 ? eq.map((p) => p.pnl) : [0];
  const rawMin = Math.min(...pnlValues);
  const rawMax = Math.max(...pnlValues);
  const range = Math.max(rawMax - rawMin, 1);
  const yMin = Math.min(rawMin, 0) - range * 0.08;
  const yMax = Math.max(rawMax, 0) + range * 0.08;
  const ySpan = Math.max(yMax - yMin, 1);

  const toX = (i: number) => PAD_L + (i / Math.max(1, eq.length - 1)) * chartW;
  const toY = (v: number) => PAD_T + chartH - ((v - yMin) / ySpan) * chartH;
  const zeroY = toY(0);

  const buildPath = (pts: { x: number; y: number }[]) =>
    pts.reduce((acc, p, i, arr) => {
      if (i === 0) return `M${p.x},${p.y}`;
      const prev = arr[i - 1];
      const cx = (prev.x + p.x) / 2;
      return `${acc} C${cx},${prev.y} ${cx},${p.y} ${p.x},${p.y}`;
    }, "");

  const coords = eq.map((p, i) => ({ x: toX(i), y: toY(p.pnl) }));

  type Seg = { pts: { x: number; y: number }[]; positive: boolean };
  const segments: Seg[] = [];
  let current: Seg | null = null;

  for (let i = 0; i < coords.length; i++) {
    const isPos = eq[i].pnl >= 0;
    if (!current || current.positive !== isPos) {
      if (current && i > 0) {
        const prev = coords[i - 1];
        const cur = coords[i];
        const denom = cur.y - prev.y || 0.001;
        const t = (zeroY - prev.y) / denom;
        const crossX = prev.x + t * (cur.x - prev.x);
        current.pts.push({ x: crossX, y: zeroY });
        segments.push(current);
        current = { pts: [{ x: crossX, y: zeroY }], positive: isPos };
      } else {
        current = { pts: [], positive: isPos };
      }
    }
    current.pts.push(coords[i]);
  }
  if (current) segments.push(current);

  const yTicks = 4;
  const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => {
    const val = yMin + (i / yTicks) * ySpan;
    return { y: toY(val), val };
  });

  const rawXLabelIndices = [0, Math.floor(eq.length / 3), Math.floor((eq.length * 2) / 3), eq.length - 1];
  const xLabelIndices = Array.from(new Set(rawXLabelIndices)).filter((idx) => eq[idx]);
  const xLabels = xLabelIndices.map((idx) => ({ x: toX(idx), label: eq[idx].date }));

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      if (!rect || eq.length < 2) return;
      const mx = ((e.clientX - rect.left) / rect.width) * W;
      const idx = Math.round(((mx - PAD_L) / chartW) * (eq.length - 1));
      const clamped = Math.max(0, Math.min(eq.length - 1, idx));
      setHover({ idx: clamped, px: toX(clamped), py: toY(eq[clamped].pnl) });
    },
    [eq, chartW]
  );

  const hoverPoint = hover !== null ? eq[hover.idx] : null;

  return (
    <div className={`${CARD} flex flex-col h-full relative overflow-hidden`}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            totalPnl >= 0
              ? "radial-gradient(circle at 20% 0%, rgba(118,208,90,0.07), transparent 60%)"
              : "radial-gradient(circle at 20% 0%, rgba(240,106,115,0.07), transparent 60%)",
        }}
      />
      <div className="p-4 pb-2 flex items-center justify-between relative z-10">
        <div>
          <div className="text-xs font-medium text-white/50 flex items-center gap-2">
            P&amp;L <span className="text-white/70">Equity Curve</span>
          </div>
          <div className="text-xl font-bold mt-0.5" style={{ color: totalPnl >= 0 ? GREEN : RED }}>
            {fmt.usd(totalPnl)}
          </div>
        </div>
        <div className="text-[11px] text-white/40">{eq.length} точок</div>
      </div>

      <div className="relative z-10 flex-1 min-h-0 px-4 pb-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="w-full h-full"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHover(null)}
        >
          {yLabels.map((l, i) => (
            <line key={i} x1={PAD_L} y1={l.y} x2={W - PAD_R} y2={l.y} stroke="rgba(255,255,255,0.06)" />
          ))}

          {segments.map((seg, si) => {
            if (seg.pts.length < 2) return null;
            const areaPath = `${buildPath(seg.pts)} L${seg.pts[seg.pts.length - 1].x},${zeroY} L${seg.pts[0].x},${zeroY} Z`;
            return <path key={`area-${si}`} d={areaPath} fill={seg.positive ? GREEN : RED} fillOpacity={0.18} />;
          })}

          {segments.map((seg, si) => {
            if (seg.pts.length < 2) return null;
            return (
              <path
                key={`line-${si}`}
                d={buildPath(seg.pts)}
                fill="none"
                stroke={seg.positive ? GREEN : RED}
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {hover && hoverPoint && (
            <>
              <line x1={hover.px} y1={PAD_T} x2={hover.px} y2={H - PAD_B} stroke="rgba(255,255,255,0.15)" />
              <circle cx={hover.px} cy={hover.py} r={4} fill="var(--background)" stroke={hoverPoint.pnl >= 0 ? GREEN : RED} strokeWidth="2" />
            </>
          )}

          {yLabels.map((l, i) => (
            <text key={i} x={W - PAD_R + 8} y={l.y + 4} fontSize="11" fill="rgba(255,255,255,0.4)">
              {l.val === 0 ? "0" : l.val > 0 ? `+${Math.round(l.val)}` : `${Math.round(l.val)}`}
            </text>
          ))}

          {xLabels.map((l, i) => (
            <text key={i} x={l.x} y={H - 5} fontSize="11" fill="rgba(255,255,255,0.35)" textAnchor="middle">
              {l.label}
            </text>
          ))}
        </svg>

        {hover && hoverPoint && (
          <div
            className="absolute rounded-lg p-2.5 text-xs z-20"
            style={{
              left: hover.px / W > 0.68 ? "auto" : `${(hover.px / W) * 100 + 1.5}%`,
              right: hover.px / W > 0.68 ? "36px" : "auto",
              top: "8px",
              background: "rgba(9,10,15,0.96)",
              border: "1px solid rgba(255,255,255,0.10)",
              backdropFilter: "blur(14px)",
              minWidth: 148,
            }}
          >
            <div className="text-white/50 mb-1">
              {hoverPoint.date}
              {hoverPoint.time ? ` · ${hoverPoint.time}` : ""}
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-white/50">P&amp;L</span>
              <span style={{ color: hoverPoint.pnl >= 0 ? GREEN : RED }}>{fmt.usd(hoverPoint.pnl)}</span>
            </div>
            {(hoverPoint.pair || hoverPoint.session || hoverPoint.emotion || hoverPoint.tradePnl !== undefined) && (
              <div className="space-y-1 pt-1 border-t border-white/10">
                <div className="flex justify-between">
                  <span className="text-white/40">Пара</span>
                  <span>{hoverPoint.pair || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Сесія</span>
                  <span>{hoverPoint.session || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Емоція</span>
                  <span>{hoverPoint.emotion || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Trade P&amp;L</span>
                  <span style={{ color: (hoverPoint.tradePnl ?? 0) >= 0 ? GREEN : RED }}>
                    {fmt.usd(hoverPoint.tradePnl ?? 0)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================
// TradesCalendar — цифра PnL під датою (замість крапки),
// клік на день з угодами відкриває деталізацію: пара, напрямок, R, PnL
// =====================================================
type CalendarTrade = {
  date: string;
  pair?: string;
  direction?: "Long" | "Short" | string;
  result_usd?: number;
  result_r?: number;
};

function TradesCalendar({ trades }: { trades: CalendarTrade[] }) {
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const monthLabel = cursor.toLocaleString("uk-UA", { month: "long", year: "numeric" });
  const weekDays = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const dayMap = useMemo(() => {
    const list = Array.isArray(trades) ? trades : [];
    const map: Record<string, { pnl: number; trades: CalendarTrade[] }> = {};
    for (const t of list) {
      const key = t.date;
      if (!key) continue;
      if (!map[key]) map[key] = { pnl: 0, trades: [] };
      map[key].pnl += t.result_usd ?? 0;
      map[key].trades.push(t);
    }
    return map;
  }, [trades]);

  const firstOfMonth = new Date(year, month, 1);
  const startDate = new Date(firstOfMonth);
  startDate.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

  const days: { date: Date; inMonth: boolean; key: string }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    days.push({ date: d, inMonth: d.getMonth() === month, key: d.toISOString().slice(0, 10) });
  }

  const today = new Date();
  const isToday = (d: Date) =>
    d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();

  const selectedDay = selectedKey ? dayMap[selectedKey] : null;

  return (
    <div className={`${CARD} flex flex-col h-full relative overflow-hidden`}>
      <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
        <div className="text-xs font-medium text-white/80 flex items-center gap-2">
          <CalendarIcon size={14} className="text-white/40" />
          Trades Calendar
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setCursor(new Date(year, month - 1, 1)); setSelectedKey(null); }}
            className="p-1 rounded-md hover:bg-white/5 transition-colors text-white/50"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => { setCursor(new Date(year, month + 1, 1)); setSelectedKey(null); }}
            className="p-1 rounded-md hover:bg-white/5 transition-colors text-white/50"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col min-h-0">
        <div className="text-xs font-medium text-center mb-2 text-white/90 capitalize shrink-0">{monthLabel}</div>

        <div className="grid grid-cols-7 gap-1 text-center mb-1 shrink-0">
          {weekDays.map((d) => (
            <div key={d} className="text-[10px] font-medium text-white/40 py-0.5">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 flex-1 min-h-0" style={{ gridTemplateRows: "repeat(6, minmax(0, 1fr))" }}>
          {days.map((day) => {
            const info = dayMap[day.key];
            const hasTrade = day.inMonth && !!info;
            const isPos = hasTrade && info.pnl > 0;
            const isNeg = hasTrade && info.pnl < 0;
            const isSelected = selectedKey === day.key;

            return (
              <button
                key={day.key}
                type="button"
                disabled={!hasTrade}
                onClick={() => setSelectedKey(isSelected ? null : hasTrade ? day.key : null)}
                className={`relative flex flex-col items-center justify-center rounded-md text-[11px] transition-colors py-1 ${
                  !day.inMonth
                    ? "text-white/20 cursor-default"
                    : hasTrade
                    ? "text-white/80 hover:bg-white/5 cursor-pointer"
                    : "text-white/50 cursor-default"
                } ${isToday(day.date) ? "font-bold" : ""} ${isSelected ? "bg-white/10" : ""}`}
              >
                {isToday(day.date) && (
                  <div className="absolute inset-0 border rounded-md pointer-events-none" style={{ borderColor: "rgba(118,208,90,0.5)" }} />
                )}
                <span>{day.date.getDate()}</span>
                {hasTrade && (
                  <span
                   className="text-[8px] font-semibold leading-none mt-0.5"
                    style={{ color: isPos ? GREEN : isNeg ? RED : "rgba(255,255,255,0.5)" }}
                  >
                    {info.pnl >= 0 ? "+" : ""}
                    {Math.abs(info.pnl) >= 1000 ? `${(info.pnl / 1000).toFixed(1)}k` : info.pnl.toFixed(0)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 pb-4 pt-2 border-t border-white/10 flex items-center gap-3 text-[11px] text-white/40 shrink-0">
        <div className="flex items-center gap-1">
          <span style={{ color: GREEN }}>+</span>
          <span>Прибуток</span>
        </div>
        <div className="flex items-center gap-1">
          <span style={{ color: RED }}>−</span>
          <span>Збиток</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm border" style={{ borderColor: "rgba(118,208,90,0.5)" }} />
          <span>Сьогодні</span>
        </div>
      </div>

      {selectedDay && (
        <div
          className="absolute z-30 rounded-xl p-3 text-xs"
          style={{
            top: "56px",
            right: "16px",
            left: "16px",
            background: "rgba(9,10,15,0.98)",
            border: "1px solid rgba(255,255,255,0.12)",
            backdropFilter: "blur(16px)",
            maxHeight: "70%",
            overflowY: "auto",
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-white/60">{selectedKey}</div>
            <div className="flex items-center gap-2">
              <span className="font-semibold" style={{ color: selectedDay.pnl >= 0 ? GREEN : RED }}>
                {fmt.usd(selectedDay.pnl)}
              </span>
              <button
                onClick={() => setSelectedKey(null)}
                className="text-white/40 hover:text-white/70 transition-colors text-sm leading-none"
              >
                ×
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            {selectedDay.trades.map((t, i) => {
              const isLong = t.direction === "Long";
              const pnlPos = (t.result_usd ?? 0) >= 0;
              return (
                <div key={i} className="flex items-center justify-between border-t border-white/5 pt-1.5 first:border-t-0 first:pt-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-white/80">{t.pair || "—"}</span>
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                      style={
                        isLong
                          ? { background: "rgba(118,208,90,0.12)", color: GREEN }
                          : { background: "rgba(240,106,115,0.12)", color: RED }
                      }
                    >
                      {t.direction || "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white/40">{t.result_r !== undefined ? `${t.result_r.toFixed(1)}R` : ""}</span>
                    <span style={{ color: pnlPos ? GREEN : RED }}>{fmt.usd(t.result_usd ?? 0)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function RDistributionChart({ buckets }: { buckets: RBucket[] }) {
  const max = Math.max(...buckets.map((b) => b.count), 1);
  const totalTrades = buckets.reduce((s, b) => s + b.count, 0);
  const bestBucket = buckets.reduce((a, b) => (b.count > a.count ? b : a), buckets[0]);

  return (
    <div className={`${CARD} p-4 flex flex-col h-full`}>
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-white/50">R-Multiple розподіл</div>
          <div className="text-lg font-semibold text-white">{totalTrades} угод</div>
        </div>
        <div className="text-right text-[11px] text-white/40">
          Найчастіше: <span className="text-white/80">{bestBucket?.range}</span>
        </div>
      </div>
      <div className="mt-1">
  <RiskSummary />
</div>

      <div className="flex items-end gap-2 flex-1 min-h-0">
        {buckets.map((b) => {
          const heightPct = Math.max((b.count / max) * 100, b.count > 0 ? 6 : 0);
          const isNeg = b.range.trim().startsWith("<") || b.range.startsWith("-2") || b.range.startsWith("-1");
          const color = isNeg ? RED : GREEN;
          return (
            <div key={b.range} className="flex flex-col items-center flex-1 gap-1 h-full justify-end">
              <span className="text-xs font-semibold" style={{ color }}>{b.count}</span>
              <div className="w-full rounded-t-md transition-all" style={{ height: `${heightPct}%`, background: color, opacity: 0.85 }} />
              <span className="text-[10px] text-white/50 mt-1">{b.range}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function AccountProgressCard() {
  const { activeAccount, activeAccountId, visibleTrades } = useTrades();

  if (activeAccountId === "all" || !activeAccount) {
    return (
      <div className={`${CARD} p-4`}>
        <div className="text-sm font-medium text-white/80">All accounts view</div>
        <div className="text-xs text-white/40 mt-1">Combined statistics across all accounts</div>
      </div>
    );
  }

  const totalPnl = visibleTrades.reduce((sum, trade) => sum + (trade.result_usd ?? 0), 0);
  const pnlPercent = activeAccount.initialBalance ? (totalPnl / activeAccount.initialBalance) * 100 : 0;

  const targetPercent = activeAccount.targetPercent ?? 0;
  const maxLossPercent = activeAccount.maxLossPercent ?? 0;
  const dailyLossPercent = activeAccount.dailyLossPercent ?? 0;

  const targetProgress = targetPercent > 0 ? clampPercent((pnlPercent / targetPercent) * 100) : 0;
  const drawdownUsed = maxLossPercent > 0 ? clampPercent((Math.abs(Math.min(pnlPercent, 0)) / maxLossPercent) * 100) : 0;
  const currentEquity = activeAccount.initialBalance + totalPnl;

  return (
    <div className={`${CARD} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-medium text-white/80 flex items-center gap-2">
            <Wallet size={14} /> {activeAccount.name}
          </div>
          <div className="text-xs text-white/40 mt-1">{phaseLabel[activeAccount.phase]}</div>
        </div>
        <div className="text-xs text-white/40 text-right">
          {activeAccount.broker} · {activeAccount.platform.toUpperCase()} · старт {fmt.usd(activeAccount.initialBalance)}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <div>
          <div className="text-xs text-white/40">Current equity</div>
          <div className="text-base font-semibold text-white">{fmt.usd(currentEquity)}</div>
        </div>
        <div>
          <div className="text-xs text-white/40 flex items-center gap-1"><Target size={12} /> Target progress</div>
          <div className="text-base font-semibold" style={{ color: GREEN }}>{fmt.pct(pnlPercent)}</div>
          <div className="text-[10px] text-white/30">{targetPercent ? `of ${fmt.pct(targetPercent)}` : "—"}</div>
        </div>
        <div>
          <div className="text-xs text-white/40 flex items-center gap-1"><ShieldAlert size={12} /> Max loss used</div>
          <div className="text-base font-semibold" style={{ color: RED }}>{fmt.pct(Math.abs(Math.min(pnlPercent, 0)))}</div>
          <div className="text-[10px] text-white/30">{maxLossPercent ? `of ${fmt.pct(maxLossPercent)}` : "—"}</div>
        </div>
        <div>
          <div className="text-xs text-white/40 flex items-center gap-1"><Flag size={12} /> Daily limit</div>
          <div className="text-base font-semibold text-white">{dailyLossPercent ? fmt.pct(dailyLossPercent) : "—"}</div>
          <div className="text-[10px] text-white/30">Trade count: {visibleTrades.length}</div>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full" style={{ width: `${targetProgress}%`, background: GREEN }} />
        </div>
        <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full" style={{ width: `${drawdownUsed}%`, background: RED }} />
        </div>
      </div>
    </div>
  );
}

export function OverviewTab() {
  const { visibleTrades, activeAccount, activeAccountId } = useTrades();

  const stats = useMemo(() => computeStats(visibleTrades), [visibleTrades]);
  const advanced = useMemo(() => computeAdvancedStats(visibleTrades), [visibleTrades]);
  const equity = useMemo(() => computeEquity(visibleTrades) as EqPoint[], [visibleTrades]);
  const monthly = useMemo(() => computeMonthly(visibleTrades), [visibleTrades]);

  const byPair = useMemo(() => {
    return groupByKey(visibleTrades, "pair").sort((a, b) => b.pnl - a.pnl).slice(0, 8);
  }, [visibleTrades]);

  const bySession = useMemo(() => {
    return groupByKey(visibleTrades, "session").sort((a, b) => b.pnl - a.pnl);
  }, [visibleTrades]);

  const byEmotion = useMemo(() => {
    return groupByKey(visibleTrades, "emotion").sort((a, b) => b.trades - a.trades);
  }, [visibleTrades]);

  let overviewSubtitle = `${visibleTrades.length} угод · Combined view`;
  if (activeAccountId !== "all") {
    const accountName = activeAccount ? activeAccount.name : "Account";
    const accountPhase = activeAccount ? phaseLabel[activeAccount.phase] : "Manual";
    overviewSubtitle = `${visibleTrades.length} угод · ${accountName} · ${accountPhase}`;
  }

  return (
    <div className="relative isolate overflow-hidden max-w-[1400px] mx-auto rounded-2xl px-1 py-1">
      <LightRays
        raysOrigin="top-center"
        raysColor="#36d7b6"
        raysSpeed={0.52}
        lightSpread={0.92}
        rayLength={1.22}
        followMouse
        mouseInfluence={0.12}
        noiseAmount={0.03}
        distortion={0.02}
      />
      <div className="relative z-10 flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-white">Огляд рахунку</h1>
        <p className="text-xs text-white/40 mt-0.5">{overviewSubtitle}</p>
      </div>

      <AccountProgressCard />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="ЗАГАЛЬНИЙ P&L"
          value={fmt.usd(stats.totalPnl)}
          hint={`${stats.wins}W / ${stats.losses}L / ${stats.breakeven}BE`}
          valueClassName={stats.totalPnl >= 0 ? "text-[var(--color-green)]" : "text-[var(--color-red)]"}
        />
        <StatCard label="WINRATE" value={fmt.pct(stats.winRate)} hint={`${stats.wins} виграшів`} />
        <StatCard
          label="PROFIT FACTOR"
          value={advanced.profitFactor === Infinity ? "∞" : advanced.profitFactor.toFixed(2)}
          hint="Gross Profit / Gross Loss"
          valueClassName={advanced.profitFactor >= 1 ? "text-[var(--color-green)]" : "text-[var(--color-red)]"}
        />
        <StatCard label="AVG WIN / R" value={`+${stats.avgR?.toFixed(2) ?? "0.00"}R`} hint="Avg Win: R-multiple" />
        <StatCard label="BEST TRADE" value={fmt.usd(stats.bestTrade)} valueClassName="text-[var(--color-green)]" />
        <StatCard label="WORST TRADE" value={fmt.usd(stats.worstTrade)} valueClassName="text-[var(--color-red)]" />
        <StreakStatCard />
        <StatCard
          label="EXPECTANCY"
          value={fmt.usd(advanced.expectancy)}
          hint="Очікуваний $ на угоду"
          valueClassName={advanced.expectancy >= 0 ? "text-[var(--color-green)]" : "text-[var(--color-red)]"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch">
        <div style={{ height: "clamp(320px, 38vh, 400px)" }} className="w-full">
          <EquityChart points={equity} totalPnl={stats.totalPnl} />
        </div>
        <div style={{ height: "clamp(320px, 38vh, 400px)" }} className="w-full">
          <TradesCalendar trades={visibleTrades} />
        </div>
      </div>
        <DrawdownPanel />
      <div style={{ height: "clamp(180px, 20vh, 220px)" }} className="w-full">
        <RDistributionChart buckets={advanced.rDistribution} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className={`${CARD} p-3.5`}>
          <SectionHeader title="Місячний P&L" />
          <div className="space-y-1.5 mt-2">
            {monthly.map((m) => {
              const isPos = m.pnl >= 0;
              const max = Math.max(...monthly.map((x) => Math.abs(x.pnl)), 1);
              const width = (Math.abs(m.pnl) / max) * 100;
              return (
                <div key={m.month} className="flex items-center gap-2 text-xs">
                  <span className="w-14 text-white/40">{m.month}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full" style={{ width: `${width}%`, background: isPos ? GREEN : RED }} />
                  </div>
                  <span style={{ color: isPos ? GREEN : RED }} className="w-14 text-right">
                    {fmt.usd(m.pnl)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div className={`${CARD} p-3.5`}>
          <SectionHeader title="По парам" />
          <div className="space-y-1.5 mt-2">
            {byPair.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <span className="text-white/70 font-mono">{item.name || "—"}</span>
                <span className="text-white/40">{item.trades}</span>
                <span style={{ color: item.pnl >= 0 ? GREEN : RED }}>{fmt.usd(item.pnl)}</span>
                <span className="text-white/40">{fmt.pct(item.winRate)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className={`${CARD} p-3.5`}>
          <SectionHeader title="По сесіях" />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {bySession.map((item) => (
              <div
                key={item.name || "unknown"}
                className="px-2.5 py-1 rounded-lg border text-xs font-medium"
                style={
                  item.pnl >= 0
                    ? { borderColor: "rgba(118,208,90,0.25)", background: "rgba(118,208,90,0.10)", color: GREEN }
                    : { borderColor: "rgba(240,106,115,0.25)", background: "rgba(240,106,115,0.10)", color: RED }
                }
              >
                {item.name || "—"} · {item.trades} угод · {fmt.usd(item.pnl)} · WR {fmt.pct(item.winRate)}
              </div>
            ))}
          </div>
        </div>
        <div className={`${CARD} p-3.5`}>
          <SectionHeader title="Емоції vs P&L" />
          <div className="space-y-1.5 mt-2">
            {byEmotion.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <span className="text-white/70">{item.name || "—"}</span>
                <span className="text-white/40">{item.trades} угод</span>
                <span style={{ color: item.pnl >= 0 ? GREEN : RED }}>{fmt.usd(item.pnl)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
