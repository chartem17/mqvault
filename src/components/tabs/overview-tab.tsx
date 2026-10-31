"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTrades, type JournalTrade } from "@/hooks/use-trades";
import { accountOverviewLabel } from "@/lib/account-overview";
import { AccountRulesCard } from "@/components/accounts/account-rules-card";
import { computeEquity, computeMonthly, computeStats, fmt, groupByKey } from "@/lib/utils-trade";
import { computeAdvancedStats, type RBucket } from "@/lib/advanced-stats";
import { StatCard } from "@/components/ui/stat-card";
import { DrawdownPanel } from "@/components/ui/drawdown-panel";
import { StreakStatCard } from "@/components/ui/streak-stat-card";
import { SectionHeader } from "@/components/ui/section-header";
import { RiskSummary } from "@/components/ui/risk-summary";
import { CARD_SURFACE as CARD, CARD_TITLE, LIST_ROW, CHART_THEME } from "@/components/ui/overview-styles";
import { SESSION_DEFINITIONS, SESSION_GROUPS, getSessionKey, getSessionLabel, getKyivDate } from "@/lib/sessions";
import { calendarCellKey, kyivDayOrNull, kyivMonthCursor } from "@/lib/trading-calendar";

type EqPoint = { date: string; time?: string; symbol?: string; session?: string; emotion?: string; tradePnl?: number; resultR?: number; pnl: number };
type CalendarTrade = { date: string; symbol?: string; direction?: "Long" | "Short" | string; net_pnl?: number; result_r?: number };
const GREEN = "var(--color-green)";
const RED = "var(--color-red)";

function sessionKeyOf(trade: JournalTrade) { try { return getSessionKey(trade.opened_at); } catch { return null; } }
function sessionGroupOf(trade: JournalTrade) { const key = sessionKeyOf(trade); return key ? SESSION_DEFINITIONS.find(session => session.key === key)?.group ?? "off" : "off"; }
function EquityChart({ points, totalPnl }: { points: EqPoint[]; totalPnl: number }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(900);
  const [measured, setMeasured] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  useEffect(() => {
    const element = chartContainerRef.current;
    if (!element) return;
    const updateWidth = () => { const nextWidth = element.getBoundingClientRect().width; if (!Number.isFinite(nextWidth) || nextWidth <= 0) return; setContainerWidth(current => Math.abs(current - nextWidth) < 0.5 ? current : nextWidth); setMeasured(true); };
    updateWidth();
    if (typeof ResizeObserver !== "undefined") { const observer = new ResizeObserver(updateWidth); observer.observe(element); return () => observer.disconnect(); }
    window.addEventListener("resize", updateWidth); return () => window.removeEventListener("resize", updateWidth);
  }, []);
  const W = containerWidth, H = 300, PAD_L = 12, PAD_R = 48, PAD_T = 14, PAD_B = 22;
  const eq = points.slice(-120);
  const chartW = Math.max(1, W - PAD_L - PAD_R), chartH = H - PAD_T - PAD_B;
  const pnlValues = eq.length > 0 ? eq.map(point => point.pnl) : [0];
  const rawMin = Math.min(...pnlValues), rawMax = Math.max(...pnlValues), range = Math.max(rawMax - rawMin, 1);
  const yMin = Math.min(rawMin, 0) - range * 0.08, yMax = Math.max(rawMax, 0) + range * 0.08, ySpan = Math.max(yMax - yMin, 1);
  const toX = (index: number) => PAD_L + index / Math.max(1, eq.length - 1) * chartW;
  const toY = (value: number) => PAD_T + chartH - (value - yMin) / ySpan * chartH;
  const zeroY = toY(0);
  const buildPath = (points: { x: number; y: number }[]) => points.reduce((acc, point, index, all) => index === 0 ? `M${point.x},${point.y}` : `${acc} C${(all[index - 1].x + point.x) / 2},${all[index - 1].y} ${(all[index - 1].x + point.x) / 2},${point.y} ${point.x},${point.y}`, "");
  const coords = eq.map((point, index) => ({ x: toX(index), y: toY(point.pnl) }));
  const segments: { pts: { x: number; y: number }[]; positive: boolean }[] = [];
  let current: { pts: { x: number; y: number }[]; positive: boolean } | null = null;
  for (let index = 0; index < coords.length; index++) {
    const positive = eq[index].pnl >= 0;
    if (!current || current.positive !== positive) {
      if (current && index > 0) { const previous = coords[index - 1], currentPoint = coords[index], denominator = currentPoint.y - previous.y || 0.001, t = (zeroY - previous.y) / denominator, crossX = previous.x + t * (currentPoint.x - previous.x); current.pts.push({ x: crossX, y: zeroY }); segments.push(current); current = { pts: [{ x: crossX, y: zeroY }], positive }; } else current = { pts: [], positive };
    }
    current.pts.push(coords[index]);
  }
  if (current) segments.push(current);
  const yLabels = Array.from({ length: 5 }, (_, index) => { const value = yMin + index / 4 * ySpan; return { y: toY(value), value }; });
  const xLabelIndices = Array.from(new Set([0, Math.floor(eq.length / 3), Math.floor(eq.length * 2 / 3), eq.length - 1])).filter(index => eq[index]);
  const xLabels = xLabelIndices.map(index => ({ x: toX(index), label: eq[index].date }));
  const handleMouseMove = useCallback((event: React.MouseEvent<SVGSVGElement>) => { const rect = event.currentTarget.getBoundingClientRect(); if (rect.width <= 0 || eq.length === 0) { setHoverIndex(null); return; } const relativeX = Math.max(0, Math.min(1, ((event.clientX - rect.left) / rect.width * W - PAD_L) / chartW)); setHoverIndex(Math.round(relativeX * Math.max(0, eq.length - 1))); }, [W, chartW, eq.length]);
  const hoverPoint = hoverIndex !== null ? eq[hoverIndex] ?? null : null;
  const hover = hoverIndex !== null && hoverPoint && coords[hoverIndex] ? { px: coords[hoverIndex].x, py: coords[hoverIndex].y } : null;
  return <div className={`${CARD} relative overflow-hidden p-5`}>
    <div className="pointer-events-none absolute inset-0 opacity-100" style={{ background: totalPnl >= 0 ? CHART_THEME.gainGlow : CHART_THEME.lossGlow }} />
    <div className="relative z-10 mb-4 flex items-start justify-between gap-4"><div><div className={CARD_TITLE}>P&amp;L Equity Curve</div><div className="mt-1 text-xs text-muted-foreground">{eq.length} точок</div></div><div className="text-right text-lg font-semibold" style={{ color: totalPnl >= 0 ? GREEN : RED }}>{fmt.usd(totalPnl)}</div></div>
    <div ref={chartContainerRef} className="relative min-w-0 w-full" style={{ height: H }}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block h-full w-full" style={{ visibility: measured ? "visible" : "hidden" }} onMouseMove={handleMouseMove} onMouseLeave={() => setHoverIndex(null)}>
        {yLabels.map((label, index) => <line key={index} x1={PAD_L} x2={W - PAD_R} y1={label.y} y2={label.y} stroke="rgb(var(--ink) / 0.07)" strokeDasharray={label.value === 0 ? "0" : "4 6"} />)}
        {segments.map((segment, index) => segment.pts.length < 2 ? null : <path key={`area-${index}`} d={`${buildPath(segment.pts)} L${segment.pts[segment.pts.length - 1].x},${zeroY} L${segment.pts[0].x},${zeroY} Z`} fill={segment.positive ? CHART_THEME.gainArea : CHART_THEME.lossArea} />)}
        {segments.map((segment, index) => segment.pts.length < 2 ? null : <path key={`line-${index}`} d={buildPath(segment.pts)} fill="none" stroke={segment.positive ? GREEN : RED} strokeWidth="3" strokeLinecap="round" />)}
        {hover && hoverPoint ? <><line x1={hover.px} x2={hover.px} y1={PAD_T} y2={H - PAD_B} stroke="rgb(var(--ink) / 0.22)" strokeDasharray="4 5" /><circle cx={hover.px} cy={hover.py} r="5" fill={CHART_THEME.pointFill} stroke={hoverPoint.pnl >= 0 ? GREEN : RED} strokeWidth="2" /></> : null}
        {yLabels.map((label, index) => <text key={`ylabel-${index}`} x={W - PAD_R + 8} y={label.y + 4} fontSize="11" fill="rgb(var(--ink) / 0.45)">{label.value === 0 ? "0" : label.value > 0 ? `+${Math.round(label.value)}` : `${Math.round(label.value)}`}</text>)}
        {xLabels.map((label, index) => <text key={`xlabel-${index}`} x={label.x} y={H - 4} textAnchor={xLabels.length === 1 || index === 0 ? "start" : index === xLabels.length - 1 ? "end" : "middle"} fontSize="11" fill="rgb(var(--ink) / 0.38)">{label.label}</text>)}
      </svg>
      {hover && hoverPoint ? <div data-dark className="pointer-events-none absolute rounded-xl px-3 py-2 text-xs text-white" style={{ left: hover.px / W > 0.68 ? "auto" : `${hover.px / W * 100 + 1.5}%`, right: hover.px / W > 0.68 ? "36px" : "auto", top: "8px", background: CHART_THEME.tooltipBackground, border: CHART_THEME.tooltipBorder, backdropFilter: "blur(14px)", minWidth: 148 }}>
        <div className="font-medium text-white/95">{hoverPoint.date}{hoverPoint.time ? ` · ${hoverPoint.time}` : ""}</div>
        <div className="mt-1 flex items-center justify-between gap-4"><span className="text-white/55">P&amp;L</span><span style={{ color: hoverPoint.pnl >= 0 ? GREEN : RED }}>{fmt.usd(hoverPoint.pnl)}</span></div>
        {hoverPoint.symbol || hoverPoint.session || hoverPoint.emotion || hoverPoint.tradePnl !== undefined ? <div className="mt-2 space-y-1 border-t border-white/10 pt-2"><div className="flex items-center justify-between gap-3"><span className="text-white/55">Пара</span><span>{hoverPoint.symbol || "—"}</span></div><div className="flex items-center justify-between gap-3"><span className="text-white/55">Сесія</span><span>{hoverPoint.session || "—"}</span></div><div className="flex items-center justify-between gap-3"><span className="text-white/55">Емоція</span><span>{hoverPoint.emotion || "—"}</span></div><div className="flex items-center justify-between gap-3"><span className="text-white/55">Trade P&amp;L</span><span style={{ color: (hoverPoint.tradePnl ?? 0) >= 0 ? GREEN : RED }}>{fmt.usd(hoverPoint.tradePnl ?? 0)}</span></div></div> : null}
      </div> : null}
    </div>
  </div>;
}
function TradesCalendar({ trades }: { trades: CalendarTrade[] }) {
  const [cursor, setCursor] = useState(() => kyivMonthCursor());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const monthLabel = cursor.toLocaleString("uk-UA", { month: "long", year: "numeric" });
  const weekDays = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const dayMap = useMemo(() => { const map: Record<string, { pnl: number; trades: CalendarTrade[] }> = {}; for (const trade of Array.isArray(trades) ? trades : []) { const key = trade.date; if (!key) continue; if (!map[key]) map[key] = { pnl: 0, trades: [] }; map[key].pnl += trade.net_pnl ?? 0; map[key].trades.push(trade); } return map; }, [trades]);
  const firstOfMonth = new Date(year, month, 1), startDate = new Date(firstOfMonth); startDate.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());
  const days = Array.from({ length: 42 }, (_, index) => { const date = new Date(startDate); date.setDate(startDate.getDate() + index); return { date, inMonth: date.getMonth() === month, key: calendarCellKey(date) }; });
  const todayKey = getKyivDate(new Date());
  const isToday = (date: Date) => calendarCellKey(date) === todayKey;
  const selectedDay = selectedKey ? dayMap[selectedKey] : null;
  return <div className={`${CARD} p-5`}>
    <div className="mb-4 flex items-center justify-between gap-3"><div><div className={CARD_TITLE}>Trades Calendar</div><div className="mt-1 text-xs text-muted-foreground">Натисни на день з угодами</div></div><div className="flex items-center gap-2"><button type="button" onClick={() => { setCursor(new Date(year, month - 1, 1)); setSelectedKey(null); }} className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary/30" aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button><div className="min-w-[140px] text-center text-sm text-foreground">{monthLabel}</div><button type="button" onClick={() => { setCursor(new Date(year, month + 1, 1)); setSelectedKey(null); }} className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary/30" aria-label="Next month"><ChevronRight className="h-4 w-4" /></button></div></div>
    <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">{weekDays.map(day => <div key={day} className="py-1">{day}</div>)}</div>
    <div className="mt-1 grid grid-cols-7 gap-1">{days.map(day => { const info = dayMap[day.key], hasTrade = day.inMonth && !!info, isSelected = selectedKey === day.key; return <button key={day.key} type="button" onClick={() => setSelectedKey(isSelected ? null : hasTrade ? day.key : null)} className={`relative flex min-h-[54px] flex-col items-center justify-center rounded-md py-1 text-[11px] transition-colors ${!day.inMonth ? "cursor-default text-muted-foreground" : hasTrade ? "cursor-pointer text-foreground hover:bg-secondary/30" : "cursor-default text-muted-foreground"} ${isToday(day.date) ? "font-bold" : ""} ${isSelected ? "bg-accent" : ""}`}><span>{day.date.getDate()}</span>{hasTrade ? <span className="mt-1 text-[10px]" style={{ color: info.pnl >= 0 ? GREEN : RED }}>{info.pnl >= 0 ? "+" : ""}{Math.abs(info.pnl) >= 1000 ? `${(info.pnl / 1000).toFixed(1)}k` : info.pnl.toFixed(0)}</span> : null}</button>; })}</div>
    <div className="mt-4 flex items-center gap-4 text-[11px] text-muted-foreground"><div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: GREEN }} /><span>Прибуток</span></div><div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: RED }} /><span>Збиток</span></div><div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-secondary0" /><span>Сьогодні</span></div></div>
    {selectedDay ? <div className="mt-4 rounded-xl border border-border bg-secondary/30 p-4"><div className="mb-3 flex items-center justify-between gap-3"><div><div className={CARD_TITLE}>{selectedKey}</div><div className="mt-1 text-xs" style={{ color: selectedDay.pnl >= 0 ? GREEN : RED }}>{fmt.usd(selectedDay.pnl)}</div></div><button type="button" onClick={() => setSelectedKey(null)} className="text-sm leading-none text-muted-foreground transition-colors hover:text-foreground" aria-label="Close day">×</button></div><div className="space-y-2">{selectedDay.trades.map((trade, index) => <div key={`${trade.date}-${trade.symbol}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2"><div className="min-w-0"><div className="truncate text-sm text-foreground">{trade.symbol || "—"}</div><div className="text-xs text-muted-foreground">{trade.direction || "—"}{typeof trade.result_r === "number" ? ` · ${trade.result_r.toFixed(1)}R` : ""}</div></div><div className="shrink-0 text-sm font-medium" style={{ color: (trade.net_pnl ?? 0) >= 0 ? GREEN : RED }}>{fmt.usd(trade.net_pnl ?? 0)}</div></div>)}</div></div> : null}
  </div>;
}
function RDistributionChart({ buckets }: { buckets: RBucket[] }) {
  const max = Math.max(...buckets.map(bucket => bucket.count), 1);
  const totalTrades = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const bestBucket = buckets.length ? buckets.reduce((best, bucket) => bucket.count > best.count ? bucket : best, buckets[0]) : null;
  return <div className={`${CARD} flex h-[320px] min-h-0 min-w-0 flex-col overflow-hidden p-5 xl:h-full`}>
    <div className="mb-4 flex shrink-0 flex-wrap items-start justify-between gap-3"><div><div className={CARD_TITLE}>R-Multiple розподіл</div><div className="mt-1 text-xs text-muted-foreground">{totalTrades} угод</div></div><div className="text-right text-xs text-muted-foreground">Найчастіше: {bestBucket?.range ?? "—"}</div></div>
    <div role="region" aria-label="R-Multiple distribution chart" tabIndex={0} className="min-h-0 flex-1 overflow-auto overscroll-contain focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><div className="flex h-full min-h-[192px] min-w-[420px] items-end gap-2">{buckets.map(bucket => { const heightPct = Math.max(bucket.count / max * 100, bucket.count > 0 ? 6 : 0), isNeg = bucket.range.trim().startsWith("<") || bucket.range.startsWith("-2") || bucket.range.startsWith("-1"); return <div key={bucket.range} className="flex h-full min-h-0 flex-1 flex-col items-center gap-2"><div className="text-[10px] text-muted-foreground">{bucket.count}</div><div className="flex min-h-0 w-full flex-1 items-end"><div className="w-full rounded-t-md" style={{ height: `${heightPct}%`, background: isNeg ? RED : GREEN, opacity: bucket.count > 0 ? 0.9 : 0.18 }} /></div><div className="text-[10px] text-muted-foreground">{bucket.range}</div></div>; })}</div></div>
  </div>;
}
export function OverviewTab() {
  const { visibleTrades, activeAccount, activeAccountId } = useTrades();
  const stats = useMemo(() => computeStats(visibleTrades), [visibleTrades]);
  const advanced = useMemo(() => computeAdvancedStats(visibleTrades), [visibleTrades]);
  const equity = useMemo(() => computeEquity(visibleTrades) as EqPoint[], [visibleTrades]);
  const monthly = useMemo(() => computeMonthly(visibleTrades), [visibleTrades]);
  const byPair = useMemo(() => groupByKey(visibleTrades, "symbol").sort((a, b) => b.pnl - a.pnl), [visibleTrades]);
  const bySession = useMemo(() => {
    const groups = new Map<string, { label: string; pnl: number; trades: number; wins: number }>();
    for (const trade of visibleTrades) {
      const group = sessionGroupOf(trade);
      const definition = SESSION_GROUPS.find(item => item.key === group);
      const label = definition?.label ?? "Off hours";
      const current = groups.get(group) ?? { label, pnl: 0, trades: 0, wins: 0 };
      current.pnl += trade.net_pnl ?? 0; current.trades += 1; if ((trade.net_pnl ?? 0) > 0) current.wins += 1;
      groups.set(group, current);
    }
    return [...groups.entries()].map(([key, value]) => ({ key, ...value })).sort((a, b) => b.pnl - a.pnl);
  }, [visibleTrades]);
  const bySubSession = useMemo(() => {
    const groups = new Map<string, { label: string; pnl: number; trades: number; wins: number }>();
    for (const trade of visibleTrades) {
      const key = sessionKeyOf(trade);
      if (!key) continue;
      const label = getSessionLabel(trade.opened_at);
      const current = groups.get(key) ?? { label, pnl: 0, trades: 0, wins: 0 };
      current.pnl += trade.net_pnl ?? 0; current.trades += 1; if ((trade.net_pnl ?? 0) > 0) current.wins += 1;
      groups.set(key, current);
    }
    return [...groups.entries()].map(([key, value]) => ({ key, ...value })).sort((a, b) => b.pnl - a.pnl);
  }, [visibleTrades]);
  const byEmotion = useMemo(() => groupByKey(visibleTrades, "emotion").sort((a, b) => b.trades - a.trades), [visibleTrades]);
  const calendarTrades = useMemo<CalendarTrade[]>(() => visibleTrades.flatMap(trade => { const date = kyivDayOrNull(trade.opened_at); return date ? [{ date, symbol: trade.symbol, direction: trade.direction, net_pnl: trade.net_pnl ?? 0, result_r: trade.result_r ?? undefined }] : []; }), [visibleTrades]);
  let overviewSubtitle = `${visibleTrades.length} угод · Combined view`;
  if (activeAccountId !== "all") overviewSubtitle = `${visibleTrades.length} угод · ${activeAccount ? activeAccount.name : "Account"} · ${activeAccount ? accountOverviewLabel(activeAccount) : "Рахунок не вибрано"}`;
  const monthlyAbsMax = Math.max(...monthly.map(item => Math.abs(item.pnl)), 1);
  return <div className="space-y-6 p-6">
    <SectionHeader title="Огляд рахунку" sub={overviewSubtitle} />
    <AccountRulesCard key={activeAccount?.id ?? "all"} account={activeAccount} accountId={activeAccountId} trades={visibleTrades} />
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><StatCard label="Net P&L" value={fmt.usd(stats.totalPnl)} colorClass={stats.totalPnl >= 0 ? "text-green" : "text-red"} /><StatCard label="Winrate" value={fmt.pct(stats.winRate)} colorClass={stats.winRate >= 50 ? "text-green" : "text-red"} /><StatCard label="Avg R" value={fmt.r(stats.avgR)} colorClass={stats.avgR >= 0 ? "text-green" : "text-red"} /><StatCard label="Profit factor" value={fmt.num(stats.profitFactor, 2)} colorClass={stats.profitFactor >= 1 ? "text-green" : "text-red"} /></div>
    <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
      <EquityChart points={equity} totalPnl={stats.totalPnl} />
      <TradesCalendar trades={calendarTrades} />
    </div>
    <div className="grid items-stretch gap-6 xl:h-[560px] xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] xl:grid-rows-[minmax(0,1fr)]">
      <DrawdownPanel />
      <RDistributionChart buckets={advanced.rDistribution} />
    </div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><StatCard label="Best trade" value={fmt.usd(stats.bestTrade)} colorClass={stats.bestTrade >= 0 ? "text-green" : "text-red"} /><StatCard label="Worst trade" value={fmt.usd(stats.worstTrade)} colorClass={stats.worstTrade >= 0 ? "text-green" : "text-red"} /><StatCard label="Avg win" value={fmt.usd(stats.avgWin)} colorClass={stats.avgWin >= 0 ? "text-green" : "text-red"} /><StatCard label="Avg loss" value={fmt.usd(stats.avgLoss)} colorClass={stats.avgLoss >= 0 ? "text-green" : "text-red"} /></div>
    <StreakStatCard />
    <div className="grid gap-6 xl:grid-cols-3">
      <div className={`${CARD} flex h-[360px] min-w-0 flex-col overflow-hidden p-5`}><div className={`${CARD_TITLE} mb-4 shrink-0`}>Monthly P&amp;L</div><div role="region" aria-label="Monthly P&L list" tabIndex={0} className="min-h-0 flex-1 space-y-3 overflow-auto overscroll-contain pr-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" style={{ scrollbarGutter: "stable" }}>{monthly.length ? monthly.map(item => { const positive = item.pnl >= 0; return <div key={item.month} className="space-y-1.5"><div className="flex items-center justify-between gap-3 text-sm"><span className="text-muted-foreground">{item.month}</span><span style={{ color: positive ? GREEN : RED }}>{fmt.usd(item.pnl)}</span></div><div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full" style={{ width: `${Math.abs(item.pnl) / monthlyAbsMax * 100}%`, background: positive ? GREEN : RED }} /></div></div>; }) : <div className="text-sm text-muted-foreground">Немає даних.</div>}</div></div>
      <div className={`${CARD} flex h-[360px] min-w-0 flex-col overflow-hidden p-5`}><div className={`${CARD_TITLE} mb-4 shrink-0`}>Top symbols</div><div role="region" aria-label="Top symbols list" tabIndex={0} className="min-h-0 flex-1 space-y-3 overflow-auto overscroll-contain pr-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" style={{ scrollbarGutter: "stable" }}>{byPair.length ? byPair.map(item => <div key={item.name} className={LIST_ROW}><div className="min-w-0"><div className="truncate text-sm text-foreground">{item.name || "—"}</div><div className="text-xs text-muted-foreground">{item.trades} trades · WR {fmt.pct(item.winRate)}</div></div><div className="shrink-0 text-sm font-medium" style={{ color: item.pnl >= 0 ? GREEN : RED }}>{fmt.usd(item.pnl)}</div></div>) : <div className="text-sm text-muted-foreground">Немає даних.</div>}</div></div>
      <div className={`${CARD} flex h-[360px] min-w-0 flex-col overflow-hidden p-5`}><div className={`${CARD_TITLE} mb-4 shrink-0`}>Sessions</div><div role="region" aria-label="Sessions and session detail" tabIndex={0} className="min-h-0 flex-1 overflow-auto overscroll-contain pr-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" style={{ scrollbarGutter: "stable" }}><div className="space-y-3">{bySession.length ? bySession.map(item => <div key={item.key} className={LIST_ROW}><div className="min-w-0"><div className="truncate text-sm text-foreground">{item.label}</div><div className="text-xs text-muted-foreground">{item.trades} trades · WR {item.trades ? Math.round(item.wins / item.trades * 100) : 0}%</div></div><div className="shrink-0 text-sm font-medium" style={{ color: item.pnl >= 0 ? GREEN : RED }}>{fmt.usd(item.pnl)}</div></div>) : <div className="text-sm text-muted-foreground">Немає даних.</div>}</div><div className="mt-4 text-xs uppercase tracking-[0.16em] text-muted-foreground">Session detail</div><div className="mt-2 flex flex-wrap gap-2">{bySubSession.map(item => <span key={item.key} className="rounded-full border border-border bg-secondary/30 px-3 py-1 text-xs text-foreground">{item.label} · {item.trades} · {fmt.usd(item.pnl)}</span>)}</div></div></div>
    </div>
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className={`${CARD} p-5`}><div className={`${CARD_TITLE} mb-4`}>Risk</div><RiskSummary /></div>
      <div className={`${CARD} p-5`}><div className={`${CARD_TITLE} mb-4`}>Emotions</div><div className="space-y-3">{byEmotion.length ? byEmotion.map(item => <div key={item.name} className={LIST_ROW}><div className="min-w-0"><div className="truncate text-sm text-foreground">{item.name || "—"}</div><div className="text-xs text-muted-foreground">{item.trades} угод</div></div><div className="shrink-0 text-sm font-medium" style={{ color: item.pnl >= 0 ? GREEN : RED }}>{fmt.usd(item.pnl)}</div></div>) : <div className="text-sm text-muted-foreground">Немає даних.</div>}</div></div>
    </div>
  </div>;
}
