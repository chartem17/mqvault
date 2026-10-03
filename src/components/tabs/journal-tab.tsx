"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";

import { ManualTradeModal } from "@/components/journal/manual-trade-modal";
import {
  useTrades,
  type JournalTrade,
  type TradeInput,
  type UpdateTradeInput,
} from "@/hooks/use-trades";
import { fmt } from "@/lib/utils-trade";

const MARKETS = ["Forex", "Crypto", "Commodities", "Index"] as const;
const SESSIONS = ["Asia", "London", "NY", "Overlap"] as const;

const POS = "var(--color-green)";
const NEG = "var(--color-red)";
const POS_BG = "color-mix(in srgb, var(--color-green) 14%, transparent)";
const NEG_BG = "color-mix(in srgb, var(--color-red) 14%, transparent)";

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function matchesSearch(trade: JournalTrade, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  return [
    trade.opened_at,
    trade.closed_at,
    trade.symbol,
    trade.market,
    trade.direction,
    trade.session,
    trade.setup,
    trade.emotion,
    trade.notes,
    trade.account_id,
    trade.entry_reason,
    trade.exit_reason,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(q);
}

function sortTrades(a: JournalTrade, b: JournalTrade) {
  const aTime = new Date(a.opened_at).getTime();
  const bTime = new Date(b.opened_at).getTime();

  if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
  if (Number.isNaN(aTime)) return 1;
  if (Number.isNaN(bTime)) return -1;

  return bTime - aTime;
}

function openAt(trade: JournalTrade) {
  return formatDateTime(trade.opened_at);
}

function closeAt(trade: JournalTrade) {
  return formatDateTime(trade.closed_at);
}

export function JournalTab() {
  const {
    visibleTrades,
    accounts,
    activeAccountId,
    loading,
    saving,
    error,
    createTrade,
    updateTrade,
    deleteTrade,
  } = useTrades();

  const [search, setSearch] = useState("");
  const [filterMarket, setFilterMarket] = useState<string>("All");
  const [filterSession, setFilterSession] = useState<string>("All");
  const [showManualModal, setShowManualModal] = useState(false);
  const [editingTrade, setEditingTrade] = useState<JournalTrade | null>(null);

  const filtered = useMemo(() => {
    return [...visibleTrades]
      .filter((trade) => matchesSearch(trade, search))
      .filter(
        (trade) => filterMarket === "All" || trade.market === filterMarket,
      )
      .filter(
        (trade) => filterSession === "All" || trade.session === filterSession,
      )
      .sort(sortTrades);
  }, [visibleTrades, search, filterMarket, filterSession]);

  function accountName(id: string) {
    return accounts.find((account) => account.id === id)?.name ?? "Unknown";
  }

  async function handleSubmit(values: TradeInput | UpdateTradeInput) {
    try {
      if ("id" in values) {
        await updateTrade(values);
      } else {
        await createTrade({
          ...values,
          source: "manual",
        });
      }

      setShowManualModal(false);
      setEditingTrade(null);
    } catch {
      // error is handled in hook state
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteTrade(id);
    } catch {
      // error is handled in hook state
    }
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-1 flex-wrap gap-2">
          <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-border bg-secondary/60 px-3 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search trades..."
              className="flex-1 bg-transparent text-sm outline-none"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          {["All", ...MARKETS].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilterMarket(value)}
              className={`rounded-lg border px-3 py-1.5 text-xs ${
                filterMarket === value
                  ? "border-primary/20 bg-primary/10 text-primary"
                  : "border-border bg-secondary/60 text-muted-foreground"
              }`}
            >
              {value}
            </button>
          ))}

          {["All", ...SESSIONS].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilterSession(value)}
              className={`rounded-lg border px-3 py-1.5 text-xs ${
                filterSession === value
                  ? "border-primary/20 bg-primary/10 text-primary"
                  : "border-border bg-secondary/60 text-muted-foreground"
              }`}
            >
              {value}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingTrade(null);
            setShowManualModal(true);
          }}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          Add trade
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              {[
                "OPEN AT",
                "CLOSE AT",
                "ACCOUNT",
                "SYMBOL",
                "MARKET",
                "DIR",
                "ENTRY",
                "EXIT",
                "RISK",
                "P/L",
                "R",
                "SESSION",
                "SETUP",
                "EMOTION",
                "",
              ].map((header) => (
                <th
                  key={header}
                  className="whitespace-nowrap px-3 py-2.5 text-left font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, index) => (
                <tr key={index} className="border-b border-border/50">
                  <td className="px-3 py-3" colSpan={15}>
                    <div className="grid grid-cols-8 gap-3">
                      {Array.from({ length: 8 }).map((__, i) => (
                        <div key={i} className="h-4 rounded bg-secondary/60" />
                      ))}
                    </div>
                  </td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={15}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  No trades found for the current filters.
                </td>
              </tr>
            ) : (
              filtered.map((trade, index) => (
                <tr
                  key={trade.id}
                  className={`border-b border-border/50 hover:bg-secondary/30 ${
                    index % 2 ? "bg-background/30" : ""
                  }`}
                >
                  <td className="whitespace-nowrap px-3 py-2 font-mono">
                    {openAt(trade)}
                  </td>

                  <td className="whitespace-nowrap px-3 py-2 font-mono text-muted-foreground">
                    {closeAt(trade)}
                  </td>

                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {accountName(trade.account_id)}
                  </td>

                  <td className="whitespace-nowrap px-3 py-2 font-mono font-semibold">
                    {trade.symbol}
                  </td>

                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {trade.market || "—"}
                  </td>

                  <td className="whitespace-nowrap px-3 py-2">
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{
                        background:
                          trade.direction === "Long" ? POS_BG : NEG_BG,
                        color: trade.direction === "Long" ? POS : NEG,
                      }}
                    >
                      {trade.direction}
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-3 py-2 font-mono">
                    {trade.entry_price ?? "—"}
                  </td>

                  <td className="whitespace-nowrap px-3 py-2 font-mono">
                    {trade.exit_price ?? "—"}
                  </td>

                  <td className="whitespace-nowrap px-3 py-2 font-mono">
                    {typeof trade.risk_percent === "number"
                      ? `${trade.risk_percent}%`
                      : "—"}
                  </td>

                  <td
                    className="whitespace-nowrap px-3 py-2 font-mono font-semibold"
                    style={{ color: (trade.net_pnl ?? 0) >= 0 ? POS : NEG }}
                  >
                    {typeof trade.net_pnl === "number"
                      ? fmt.usd(trade.net_pnl)
                      : "—"}
                  </td>

                  <td
                    className="whitespace-nowrap px-3 py-2 font-mono"
                    style={{ color: (trade.result_r ?? 0) >= 0 ? POS : NEG }}
                  >
                    {typeof trade.result_r === "number"
                      ? fmt.r(trade.result_r)
                      : "—"}
                  </td>

                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {trade.session || "—"}
                  </td>

                  <td className="whitespace-nowrap px-3 py-2">
                    {trade.setup || "—"}
                  </td>

                  <td className="whitespace-nowrap px-3 py-2">
                    {trade.emotion || "—"}
                  </td>

                  <td className="whitespace-nowrap px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTrade(trade);
                          setShowManualModal(true);
                        }}
                        className="rounded p-1 text-muted-foreground hover:text-foreground"
                        aria-label="Edit trade"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleDelete(trade.id)}
                        disabled={saving}
                        className="rounded p-1 text-muted-foreground hover:text-red-400 disabled:opacity-50"
                        aria-label="Delete trade"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ManualTradeModal
        open={showManualModal}
        accounts={accounts}
        defaultAccountId={
          activeAccountId !== "all" ? activeAccountId : undefined
        }
        initialTrade={editingTrade}
        submitting={saving}
        onClose={() => {
          setShowManualModal(false);
          setEditingTrade(null);
        }}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
