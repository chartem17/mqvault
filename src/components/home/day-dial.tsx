"use client";
import { useMemo } from "react";
import { dayWindow, fractionOf, sessionSegments } from "@/lib/day-dial";
import { getSessionGroup, type SessionGroup } from "@/lib/sessions";
import { zonedParts } from "@/lib/timezone";
import { fmt } from "@/lib/utils-trade";
import { msg } from "@/lib/i18n/core";
import { useI18n } from "@/components/providers/i18n-provider";

export type DialTrade = { id: string; symbol: string; opened_at: string; closed_at?: string | null; net_pnl?: number | null; result_r?: number | null };

const SIZE = 460, C = SIZE / 2, RING = 178, TRACK = 138;
const GROUP_COLOR: Record<SessionGroup, string> = { asia: "oklch(0.68 0.13 285)", london: "var(--color-gold)", new_york: "var(--color-teal)", off: "currentColor" };
const GROUP_LABEL: Record<SessionGroup, string> = { asia: "Asia", london: "London", new_york: "New York", off: msg("Outside sessions") };
const DISPLAY = "var(--font-home-display), var(--font-ui), system-ui, sans-serif";

const point = (fraction: number, radius: number) => { const angle = (fraction * 360 - 90) * Math.PI / 180; return { x: C + radius * Math.cos(angle), y: C + radius * Math.sin(angle) }; };
function arc(from: number, to: number, radius: number) {
  const a = point(from, radius), b = point(Math.min(to, 0.99999), radius);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${radius} ${radius} 0 ${to - from > 0.5 ? 1 : 0} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}
function wedge(to: number) {
  const a = point(0, C), b = point(Math.min(to, 0.99999), C);
  return `M ${C} ${C} L ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${C} ${C} 0 ${to > 0.5 ? 1 : 0} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)} Z`;
}

/** The trader's day as a dial: real market sessions on the ring, "now" needle, today's trades as dots. */
export function DayDial({ trades, timezone, now, netToday }: { trades: readonly DialTrade[]; timezone: string; now: Date; netToday: number | null }) {
  const { t, intl } = useI18n();
  const model = useMemo(() => {
    const window = dayWindow(timezone, now.getTime());
    const nowFraction = fractionOf(now.getTime(), window) ?? 0;
    const segments = sessionSegments(window);
    const marks = [0, 6, 12, 18].map(hour => ({ fraction: hour * 3_600_000 / (window.end - window.start), label: String(zonedParts(window.start + hour * 3_600_000, timezone).hour).padStart(2, "0") }));
    const dots = trades.flatMap(trade => {
      const fraction = fractionOf(Date.parse(trade.opened_at), window);
      if (fraction === null) return [];
      const open = !trade.closed_at;
      const pnl = typeof trade.net_pnl === "number" ? trade.net_pnl : null;
      const radius = 5 + (typeof trade.result_r === "number" ? Math.min(5, Math.abs(trade.result_r) * 2) : 1);
      return [{ id: trade.id, symbol: trade.symbol, fraction, open, pnl, radius }];
    });
    return { nowFraction, segments, marks, dots };
  }, [trades, timezone, now]);

  const time = new Intl.DateTimeFormat(intl, { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
  const currentGroup = getSessionGroup(now);
  const needle = { a: point(model.nowFraction, 112), b: point(model.nowFraction, RING + 12), knob: point(model.nowFraction, RING) };
  const label = t("Day dial. Now {time}, {session}. Trades today: {count}.", { time, session: t(GROUP_LABEL[currentGroup]), count: model.dots.length });
  const segment = (item: { group: SessionGroup; from: number; to: number }, index: number, dim: boolean) => (
    <path key={`${dim ? "d" : "f"}${index}`} d={arc(item.from, item.to, RING)} pathLength={1} fill="none" strokeWidth={16} stroke={GROUP_COLOR[item.group]}
      strokeOpacity={item.group === "off" ? (dim ? 0.07 : 0.16) : dim ? 0.3 : 0.95} className="dial-draw" style={{ animationDelay: `${index * 90}ms` }} />
  );

  return <figure className="m-0 mx-auto w-full max-w-[460px] text-foreground">
    <style>{`
      .dial-draw { stroke-dasharray: 1; stroke-dashoffset: 0; animation: dialDraw 900ms cubic-bezier(.3,.7,.2,1) both; }
      @keyframes dialDraw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
      @media (prefers-reduced-motion: reduce) { .dial-draw { animation: none; } }
    `}</style>
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={label} className="block h-auto w-full overflow-visible">
      <defs><clipPath id="dial-elapsed"><path d={wedge(model.nowFraction)} /></clipPath></defs>
      <circle cx={C} cy={C} r={TRACK} fill="none" stroke="currentColor" strokeOpacity={0.09} strokeWidth={1} />
      {model.segments.map((item, index) => segment(item, index, true))}
      <g clipPath="url(#dial-elapsed)">{model.segments.map((item, index) => segment(item, index, false))}</g>
      {model.marks.map(mark => { const p = point(mark.fraction, RING + 34); const t = point(mark.fraction, RING + 14), u = point(mark.fraction, RING + 22);
        return <g key={mark.label}><line x1={t.x} y1={t.y} x2={u.x} y2={u.y} stroke="currentColor" strokeOpacity={0.35} /><text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize={12} fill="currentColor" fillOpacity={0.5} style={{ fontFamily: DISPLAY }}>{mark.label}</text></g>; })}
      {model.dots.map(dot => { const p = point(dot.fraction, TRACK); const tone = dot.pnl === null ? "currentColor" : dot.pnl > 0 ? "var(--color-green)" : dot.pnl < 0 ? "var(--color-red)" : "currentColor";
        return <circle key={dot.id} cx={p.x} cy={p.y} r={dot.radius} fill={dot.open ? "var(--page-bg)" : tone} fillOpacity={dot.open ? 1 : 0.9} stroke={tone} strokeWidth={dot.open ? 2 : 0} strokeOpacity={dot.pnl === null ? 0.6 : 1}><title>{`${dot.symbol}${dot.pnl === null ? "" : ` · ${fmt.usd(dot.pnl)}`}${dot.open ? ` · ${t("open")}` : ""}`}</title></circle>; })}
      <line x1={needle.a.x} y1={needle.a.y} x2={needle.b.x} y2={needle.b.y} stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      <circle cx={needle.knob.x} cy={needle.knob.y} r={6} fill="var(--page-bg)" stroke="currentColor" strokeWidth={2.5} />
      <text x={C} y={C - 12} textAnchor="middle" dominantBaseline="central" fontSize={46} fontWeight={600} fill="currentColor" style={{ fontFamily: DISPLAY, letterSpacing: "-0.02em" }}>{time}</text>
      <text x={C} y={C + 28} textAnchor="middle" dominantBaseline="central" fontSize={17} fontWeight={500} fill={netToday === null || netToday === 0 ? "currentColor" : netToday > 0 ? "var(--color-green)" : "var(--color-red)"} fillOpacity={netToday ? 1 : 0.55} style={{ fontFamily: DISPLAY }}>{netToday === null ? "—" : fmt.usd(netToday)}</text>
      <text x={C} y={C + 54} textAnchor="middle" dominantBaseline="central" fontSize={13} fill="currentColor" fillOpacity={0.55}>{t(GROUP_LABEL[currentGroup])}</text>
    </svg>
    <figcaption className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
      <span className="sr-only">{label}</span>
      {(["asia", "london", "new_york"] as const).map(group => <span key={group} className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: GROUP_COLOR[group] }} />{GROUP_LABEL[group]}</span>)}
    </figcaption>
  </figure>;
}
