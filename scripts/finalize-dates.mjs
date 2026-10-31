import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const strategyPath = "src/components/tabs/strategy-control-tab.tsx";
const overviewPath = "src/components/tabs/overview-tab.tsx";
const expected = new Map([[strategyPath, "09703dc854151f05d1a6bb1d3179f0e544e95c68"], [overviewPath, "0ab354e9c4b1461e1d68cb34eb1d7ff05f777fa0"]]);
const contents = new Map();
for (const [path, sha] of expected) {
  const actual = execFileSync("git", ["hash-object", path], { encoding: "utf8" }).trim();
  if (actual !== sha) throw new Error(`Source changed; refusing to overwrite ${path}`);
  contents.set(path, readFileSync(path, "utf8"));
}
function replace(path, oldText, newText) {
  const text = contents.get(path);
  if (text.split(oldText).length !== 2) throw new Error(`Expected exactly one matching fragment in ${path}`);
  contents.set(path, text.replace(oldText, newText));
}
replace(strategyPath, 'import { useRouter } from "next/navigation";', 'import { useRouter } from "next/navigation";\nimport { defaultKyivPeriod, isInKyivPeriod } from "@/lib/trading-calendar";');
replace(strategyPath, 'function dateInput(value: Date) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`; }\n', '');
replace(strategyPath, 'function getDefaultRange() { const end = new Date(); const start = new Date(end); start.setMonth(start.getMonth() - 3); return { start: dateInput(start), end: dateInput(end) }; }', 'function getDefaultRange() { return defaultKyivPeriod(); }');
replace(strategyPath, 'const filteredTrades = useMemo(() => visibleTrades.filter(trade => { const day = trade.opened_at.slice(0, 10); return day >= period.start && day <= period.end; }), [visibleTrades, period]);', 'const filteredTrades = useMemo(() => visibleTrades.filter(trade => isInKyivPeriod(trade.opened_at, period)), [visibleTrades, period]);');
replace(overviewPath, 'import { SESSION_DEFINITIONS, SESSION_GROUPS, getSessionKey, getSessionLabel } from "@/lib/sessions";', 'import { SESSION_DEFINITIONS, SESSION_GROUPS, getSessionKey, getSessionLabel, getKyivDate } from "@/lib/sessions";\nimport { calendarCellKey, kyivDayOrNull, kyivMonthCursor } from "@/lib/trading-calendar";');
replace(overviewPath, 'const [cursor, setCursor] = useState(() => new Date());', 'const [cursor, setCursor] = useState(() => kyivMonthCursor());');
replace(overviewPath, 'key: date.toISOString().slice(0, 10)', 'key: calendarCellKey(date)');
replace(overviewPath, 'const today = new Date();\n  const isToday = (date: Date) => date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();', 'const todayKey = getKyivDate(new Date());\n  const isToday = (date: Date) => calendarCellKey(date) === todayKey;');
replace(overviewPath, 'const calendarTrades = useMemo<CalendarTrade[]>(() => visibleTrades.map(trade => ({ date: String(trade.opened_at ?? "").slice(0, 10), symbol: trade.symbol, direction: trade.direction, net_pnl: trade.net_pnl ?? 0, result_r: trade.result_r ?? undefined })), [visibleTrades]);', 'const calendarTrades = useMemo<CalendarTrade[]>(() => visibleTrades.flatMap(trade => { const date = kyivDayOrNull(trade.opened_at); return date ? [{ date, symbol: trade.symbol, direction: trade.direction, net_pnl: trade.net_pnl ?? 0, result_r: trade.result_r ?? undefined }] : []; }), [visibleTrades]);');
for (const [path, text] of contents) writeFileSync(path, text);
