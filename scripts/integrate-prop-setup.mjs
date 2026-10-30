import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const paths = { model: "src/lib/account-data.ts", setup: "src/lib/account-setup.ts", hook: "src/hooks/use-trades.tsx", switcher: "src/components/account-switcher.tsx", api: "src/app/api/accounts/route.ts", overview: "src/components/tabs/overview-tab.tsx" };
const expected = { model: "c949023ebf7fb3c23672bab8a16d025b6ba0dca6", setup: "e56b24a5c6e85dcb08f59c0cbdbebca378a08268", hook: "17b55fabdd949c0197a07a1559909b049cd4ea69", switcher: "87512423af676ccb1facf107da04bb5639d803e8", api: "a60ed52b4b00c6fe129fd75fe64399f0dbee8967", overview: "41b58179233e01c8ed7df61403529cce86b3c6c9" };
const files = {};
for (const [key, path] of Object.entries(paths)) {
  if (execFileSync("git", ["hash-object", path], { encoding: "utf8" }).trim() !== expected[key]) throw new Error(`Source changed: ${path}`);
  files[key] = readFileSync(path, "utf8");
}
function edit(key, before, after) {
  if (files[key].split(before).length !== 2) throw new Error(`Expected one fragment in ${paths[key]}`);
  files[key] = files[key].replace(before, after);
}
edit("model", '"phase-1" | "phase-2" | "funded" | "manual"', '"phase-1" | "phase-2" | "phase-3" | "funded" | "manual"');
edit("model", 'export type TradingAccount = {', 'export type TradingAccount = {\n  accountType?: "personal" | "prop";\n  minTradingDays?: number;');
edit("model", '  "phase-2": "Phase 2",', '  "phase-2": "Phase 2",\n  "phase-3": "Phase 3",');
edit("setup", 'if (phase !== null && !["phase-1", "phase-2", "phase-3", "funded"].includes(String(phase)))', 'if (phase !== null && (typeof phase !== "string" || !["phase-1", "phase-2", "phase-3", "funded"].includes(phase)))');
edit("hook", 'parent_account_id?: string | null };', 'parent_account_id?: string | null; min_trading_days?: number | null };');
edit("hook", 'export type AccountInput = { id?: string;', 'export type AccountInput = { id?: string; accountType?: "personal" | "prop"; minTradingDays?: number | null;');
edit("hook", 'phase?: AccountPhase;', 'phase?: AccountPhase | null;');
edit("hook", 'targetPercent?: number; maxLossPercent?: number; dailyLossPercent?: number;', 'targetPercent?: number | null; maxLossPercent?: number | null; dailyLossPercent?: number | null;');
edit("hook", 'const PROP_PHASES: AccountPhase[] = ["phase-1", "phase-2", "funded"];', 'const PROP_PHASES: AccountPhase[] = ["phase-1", "phase-2", "phase-3", "funded"];');
edit("hook", 'return { id: a.id, name: a.name,', 'return { id: a.id, accountType: a.account_type === "prop" ? "prop" : "personal", minTradingDays: a.min_trading_days ?? undefined, name: a.name,');
edit("hook", 'account_type: input.platform === "mt5" ? "prop" : "personal"', 'account_type: input.accountType');
edit("hook", 'phase: input.phase ?? (input.platform === "mt5" ? "phase-1" : null)', 'phase: input.phase');
edit("hook", 'broker: input.broker ?? null', 'broker: input.broker');
edit("hook", 'status: input.status ?? "active"', 'status: input.status');
edit("hook", 'dailyLossPercent: input.dailyLossPercent, parentAccountId:', 'dailyLossPercent: input.dailyLossPercent, minTradingDays: input.minTradingDays, parentAccountId:');
const start = files.switcher.indexOf("const COLORS = ");
const end = files.switcher.indexOf("function Mt5Panel()", start);
if (start < 0 || end < 0) throw new Error("Cannot find old creation modal boundary");
files.switcher = files.switcher.slice(0, start) + files.switcher.slice(end);
edit("switcher", 'import { useMemo, useState } from "react";', 'import { useState } from "react";\nimport { NewAccountModal } from "@/components/accounts/new-account-modal";');
edit("switcher", 'import { createPortal } from "react-dom";\n', '');
edit("switcher", 'import { Activity, Check, CheckSquare, ChevronDown, Crown, Layers3, Plus, Radio, Square, Trash2, Wallet2, X } from "lucide-react";', 'import { Activity, Check, CheckSquare, ChevronDown, Layers3, Plus, Radio, Square, Trash2, Wallet2 } from "lucide-react";');
edit("switcher", 'import { kindLabel, type AccountKind } from "@/lib/account-data";', 'import { kindLabel } from "@/lib/account-data";');
edit("switcher", 'const [modal, setModal] = useState(false);', 'const [modal, setModal] = useState(false);\n  const [modalPlatform, setModalPlatform] = useState<"manual" | "mt5">("manual");');
const linkStart = files.switcher.indexOf("  async function linkCurrentMt5() {");
const linkEnd = files.switcher.indexOf("  return <>", linkStart);
if (linkStart < 0 || linkEnd < 0) throw new Error("Cannot find MT5 link handler boundary");
files.switcher = files.switcher.slice(0, linkStart) + '  async function linkCurrentMt5() {\n    if (!health.login) return;\n    const existing = accounts.find(account => account.mt5Login === String(health.login));\n    if (existing) { setActiveAccountId(existing.id); setOpen(false); return; }\n    setModalPlatform("mt5"); setOpen(false); setModal(true);\n  }\n' + files.switcher.slice(linkEnd);
edit("switcher", 'onClick={() => { setOpen(false); setModal(true); }}', 'onClick={() => { setModalPlatform("manual"); setOpen(false); setModal(true); }}');
edit("switcher", '<NewAccountModal onClose=', '<NewAccountModal initialPlatform={modalPlatform} onClose=');
files.api = 'export const dynamic = "force-dynamic";\nexport { GET, POST, PATCH, DELETE } from "@/lib/account-api";\n';
edit("overview", '  const targetPercent = activeAccount.targetPercent ?? 0;', '  if (activeAccount.accountType !== "prop") return <div className={`${CARD} p-5`}><div className="text-base font-semibold text-white">{activeAccount.name}</div><div className="mt-1 text-xs text-white/60">Особистий рахунок · {activeAccount.broker || "—"} · {activeAccount.platform.toUpperCase()}</div><div className="mt-4 text-xs text-white/45">Баланс за журналом</div><div className="mt-1 text-lg font-semibold" style={{ color: totalPnl >= 0 ? GREEN : RED }}>{fmt.usd(activeAccount.initialBalance + totalPnl)}</div></div>;\n  const targetPercent = activeAccount.targetPercent ?? 0;');
for (const [key, path] of Object.entries(paths)) writeFileSync(path, files[key]);
