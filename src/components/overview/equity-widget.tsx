"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTrades } from "@/hooks/use-trades";
import { computeEquity, computeStats, fmt } from "@/lib/utils-trade";
import { CHART_THEME } from "@/components/ui/overview-styles";
import { useTimezone } from "@/components/providers/timezone-provider";
import { WidgetPanel } from "./widget-panel";

type EqPoint = { date: string; time?: string; symbol?: string; session?: string; emotion?: string; tradePnl?: number; resultR?: number; pnl: number };
const GREEN = "var(--color-green)";
const RED = "var(--color-red)";
function EquityChart({ points, totalPnl }: { points: EqPoint[]; totalPnl: number }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 900, height: 260 });
  const [measured, setMeasured] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  useEffect(() => {
    const element = chartContainerRef.current;
    if (!element) return;
    const update = () => { const rect = element.getBoundingClientRect(); if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0) return; setSize(current => Math.abs(current.width - rect.width) < 0.5 && Math.abs(current.height - rect.height) < 0.5 ? current : { width: rect.width, height: rect.height }); setMeasured(true); };
    update();
    if (typeof ResizeObserver !== "undefined") { const observer = new ResizeObserver(update); observer.observe(element); return () => observer.disconnect(); }
    window.addEventListener("resize", update); return () => window.removeEventListener("resize", update);
  }, []);
  const W = size.width, H = Math.max(140, size.height), PAD_L = 12, PAD_R = 48, PAD_T = 14, PAD_B = 22;
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
  return <WidgetPanel title="Equity curve" sub={`${eq.length} точок`} aside={<div className="text-right text-lg font-semibold" style={{ color: totalPnl >= 0 ? GREEN : RED }}>{fmt.usd(totalPnl)}</div>} className="isolate">
    <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: totalPnl >= 0 ? CHART_THEME.gainGlow : CHART_THEME.lossGlow }} />
    <div ref={chartContainerRef} className="relative h-full min-h-[140px] w-full min-w-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-full w-full" style={{ visibility: measured ? "visible" : "hidden" }} onMouseMove={handleMouseMove} onMouseLeave={() => setHoverIndex(null)}>
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
  </WidgetPanel>;
}

export function EquityWidget() {
  const { visibleTrades } = useTrades();
  const { timezone } = useTimezone();
  const stats = useMemo(() => computeStats(visibleTrades), [visibleTrades]);
  const equity = useMemo(() => computeEquity(visibleTrades, timezone) as EqPoint[], [visibleTrades, timezone]);
  return <EquityChart points={equity} totalPnl={stats.totalPnl} />;
}
