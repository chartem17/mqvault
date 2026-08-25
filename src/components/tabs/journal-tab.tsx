"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTrades, type AccountTrade } from "@/hooks/use-trades";
import { fmt } from "@/lib/utils-trade";
import {
  AlertTriangle,
  ChevronDown,
  ExternalLink,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

const ASSETS = [
  { symbol: "BTC/USDT", market: "Crypto" },
  { symbol: "ETH/USDT", market: "Crypto" },
  { symbol: "EUR/USD", market: "Forex" },
  { symbol: "GBP/USD", market: "Forex" },
  { symbol: "XAU/USD", market: "Commodities" },
  { symbol: "XAG/USD", market: "Commodities" },
  { symbol: "US30", market: "Index" },
  { symbol: "GER40", market: "Index" },
] as const;

const MARKETS = ["Forex", "Crypto", "Commodities", "Index"] as const;
const SESSIONS = ["Asia", "London", "NY", "Overlap"] as const;

const POS = "var(--color-green)";
const NEG = "var(--color-red)";
const POS_BG = "color-mix(in srgb, var(--color-green) 14%, transparent)";
const NEG_BG = "color-mix(in srgb, var(--color-red) 14%, transparent)";

type FormTrade = Omit<AccountTrade, "id">;

const EMPTY: FormTrade = {
  accountId: "manual",
  source: "manual",
  date: "",
  time: "",
  pair: "",
  market: "",
  direction: "Long",
  entry: "",
  stop: "",
  tp: "",
  exit_price: "",
  risk_pct: 1,
  result_usd: 0,
  result_r: 0,
  session: "",
  setup: "",
  htf_bias: "",
  entry_reason: "",
  exit_reason: "",
  emotion: "",
  mistake: "",
  screenshot: "",
  notes: "",
};

function marketFor(pair: string) {
  return ASSETS.find((asset) => asset.symbol === pair)?.market ?? "";
}

function sessionFor(time: string) {
  if (!time.includes(":")) return "";

  const [h, m] = time.split(":").map(Number);

  if (Number.isNaN(h) || Number.isNaN(m)) return "";

  const total = h * 60 + m;

  if (total < 8 * 60) return "Asia";
  if (total < 13 * 60) return "London";
  if (total < 17 * 60) return "Overlap";

  return "NY";
}

export function JournalTab() {
  const {
    visibleTrades: trades,
    accounts,
    activeAccountId,
    activeAccount,
    addTrade,
    updateTrade,
    deleteTrade,
  } = useTrades();

  const [search, setSearch] = useState("");
  const [filterMarket, setFilterMarket] = useState("All");
  const [filterSession, setFilterSession] = useState("All");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AccountTrade | null>(null);
  const [form, setForm] = useState<FormTrade>(EMPTY);

  const [pairQuery, setPairQuery] = useState("");
  const [pairOpen, setPairOpen] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<AccountTrade | null>(
    null
  );
  const [pendingDelete, setPendingDelete] = useState<AccountTrade | null>(
    null
  );

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const filtered = useMemo(() => {
    return trades
      .filter((trade) => {
        const q = search.trim().toLowerCase();

        const matchesSearch =
          !q ||
          [
            trade.pair,
            trade.date,
            trade.setup,
            trade.notes,
            trade.accountId,
          ]
            .join(" ")
            .toLowerCase()
            .includes(q);

        return (
          (filterMarket === "All" || trade.market === filterMarket) &&
          (filterSession === "All" || trade.session === filterSession) &&
          matchesSearch
        );
      })
      .sort((a, b) =>
        `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)
      );
  }, [trades, search, filterMarket, filterSession]);

  const matchingAssets = useMemo(() => {
    const q = pairQuery.toLowerCase();

    return ASSETS.filter(
      (asset) =>
        !q ||
        `${asset.symbol} ${asset.market}`.toLowerCase().includes(q)
    );
  }, [pairQuery]);

  function accountName(id: string) {
    return accounts.find((account) => account.id === id)?.name ?? "Unknown";
  }

  function openAdd() {
    setEditing(null);

    setForm({
      ...EMPTY,
      accountId: activeAccountId === "all" ? "manual" : activeAccountId,
      source: "manual",
    });

    setPairQuery("");
    setPairOpen(false);
    setShowForm(true);
  }

  function openEdit(trade: AccountTrade) {
    setEditing(trade);
    setForm({ ...trade });
    setPairQuery(trade.pair);
    setPairOpen(false);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setPairOpen(false);
  }

  function choosePair(pair: string) {
    setForm((previous) => ({
      ...previous,
      pair,
      market: marketFor(pair) || previous.market,
    }));

    setPairQuery(pair);
    setPairOpen(false);
  }

  function changeTime(time: string) {
    setForm((previous) => ({
      ...previous,
      time,
      session: sessionFor(time) || previous.session,
    }));
  }

  function save() {
    const payload: FormTrade = {
      ...form,
      market: form.market || marketFor(form.pair) || "Forex",
      session: form.session || sessionFor(form.time) || "London",
      risk_pct: Number(form.risk_pct) || 0,
      result_usd: Number(form.result_usd) || 0,
      result_r: Number(form.result_r) || 0,
    };

    if (editing) {
      updateTrade({ ...payload, id: editing.id });
    } else {
      addTrade(payload);
    }

    closeForm();
  }

  function remove() {
    if (!confirmDelete) return;

    const trade = confirmDelete;

    setConfirmDelete(null);
    setPendingDelete(trade);

    timer.current = setTimeout(() => {
      deleteTrade(trade.id);
      setPendingDelete(null);
    }, 6000);
  }

  function undo() {
    if (timer.current) clearTimeout(timer.current);
    setPendingDelete(null);
  }

  function setField<K extends keyof FormTrade>(
    key: K,
    value: FormTrade[K]
  ) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function input(
    key: keyof FormTrade,
    label: string,
    type = "text"
  ) {
    return (
      <label className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
          {label}
        </span>

        <input
          type={type}
          value={String(form[key] ?? "")}
          onChange={(event) =>
            setField(key, event.target.value as never)
          }
          className="bg-secondary/60 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
        />
      </label>
    );
  }

  function select(
    key: keyof FormTrade,
    label: string,
    values: readonly string[]
  ) {
    return (
      <label className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
          {label}
        </span>

        <select
          value={String(form[key] ?? "")}
          onChange={(event) =>
            setField(key, event.target.value as never)
          }
          className="bg-secondary/60 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
        >
          {values.map((value) => (
            <option key={value} value={value}>
              {value || "—"}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1
            className="text-xl font-bold"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {activeAccount
              ? activeAccount.name
              : "All accounts · Journal"}
          </h1>

          <p className="text-xs text-muted-foreground mt-0.5">
            {filtered.length} з {trades.length} угод
            {activeAccount
              ? ` · ${activeAccount.phase.replace("-", " ")}`
              : " · Combined view"}
          </p>
        </div>

        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Нова угода
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2 bg-secondary/60 border border-border rounded-lg px-3 py-1.5 flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Пошук угоди"
            className="bg-transparent text-sm flex-1 outline-none"
          />

          {search && (
            <button onClick={() => setSearch("")}>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {["All", ...MARKETS].map((value) => (
          <button
            key={value}
            onClick={() => setFilterMarket(value)}
            className={`px-3 py-1.5 rounded-lg text-xs border ${
              filterMarket === value
                ? "bg-primary/10 text-primary border-primary/20"
                : "bg-secondary/60 border-border text-muted-foreground"
            }`}
          >
            {value}
          </button>
        ))}

        {["All", ...SESSIONS].map((value) => (
          <button
            key={value}
            onClick={() => setFilterSession(value)}
            className={`px-3 py-1.5 rounded-lg text-xs border ${
              filterSession === value
                ? "bg-primary/10 text-primary border-primary/20"
                : "bg-secondary/60 border-border text-muted-foreground"
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              {[
                "Date",
                "Time",
                "Account",
                "Pair",
                "Market",
                "Dir",
                "Entry",
                "Exit",
                "Risk",
                "P&L",
                "R",
                "Session",
                "Setup",
                "Emotion",
                "",
              ].map((header) => (
                <th
                  key={header}
                  className="px-3 py-2.5 text-left text-muted-foreground font-semibold uppercase tracking-wider whitespace-nowrap"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {filtered.map((trade, index) => (
              <tr
                key={trade.id}
                className={`border-b border-border/50 hover:bg-secondary/30 ${
                  index % 2 ? "bg-background/30" : ""
                }`}
              >
                <td className="px-3 py-2 font-mono">
                  {trade.date}
                </td>

                <td className="px-3 py-2 font-mono text-muted-foreground whitespace-nowrap">
                  {trade.time || "—"}
                </td>

                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                  {accountName(trade.accountId)}
                </td>

                <td className="px-3 py-2 font-mono font-semibold">
                  {trade.pair}
                </td>

                <td className="px-3 py-2 text-muted-foreground">
                  {trade.market}
                </td>

                <td className="px-3 py-2">
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                    style={{
                      background:
                        trade.direction === "Long" ? POS_BG : NEG_BG,
                      color: trade.direction === "Long" ? POS : NEG,
                    }}
                  >
                    {trade.direction}
                  </span>
                </td>

                <td className="px-3 py-2 font-mono">{trade.entry}</td>
                <td className="px-3 py-2 font-mono">{trade.exit_price}</td>
                <td className="px-3 py-2 font-mono">{trade.risk_pct}%</td>

                <td
                  className="px-3 py-2 font-mono font-semibold"
                  style={{ color: trade.result_usd >= 0 ? POS : NEG }}
                >
                  {fmt.usd(trade.result_usd)}
                </td>

                <td
                  className="px-3 py-2 font-mono"
                  style={{ color: trade.result_r >= 0 ? POS : NEG }}
                >
                  {fmt.r(trade.result_r)}
                </td>

                <td className="px-3 py-2 text-muted-foreground">
                  {trade.session}
                </td>

                <td className="px-3 py-2">{trade.setup}</td>
                <td className="px-3 py-2">{trade.emotion}</td>

                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    {trade.screenshot && (
                      <a
                        href={trade.screenshot}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 text-muted-foreground hover:text-primary"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}

                    <button
                      onClick={() => openEdit(trade)}
                      className="p-1 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setConfirmDelete(trade)}
                      className="p-1 text-muted-foreground hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
            onClick={closeForm}
          />

          <aside className="absolute inset-y-0 right-0 w-full max-w-2xl bg-card border-l border-border shadow-2xl flex flex-col">
            <header className="border-b border-border px-5 py-4 flex justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[.18em] text-muted-foreground">
                  Trade ticket
                </p>

                <h2 className="font-semibold mt-1">
                  {editing ? "Редагувати угоду" : "Нова угода"}
                </h2>
              </div>

              <button onClick={closeForm}>
                <X className="w-5 h-5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <section className="rounded-2xl border border-border bg-secondary/20 p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold">Execution</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Базові параметри входу, виходу та ризику.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {input("date", "Date", "date")}

                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Time
                    </span>

                    <input
                      type="time"
                      value={form.time}
                      onChange={(event) => changeTime(event.target.value)}
                      className="bg-secondary/60 border border-border rounded-lg px-3 py-2 text-sm outline-none"
                    />
                  </label>

                  <label className="col-span-2 flex flex-col gap-1 relative">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Pair
                    </span>

                    <div className="relative">
                      <input
                        value={pairQuery}
                        onChange={(event) => {
                          setPairQuery(event.target.value);
                          setPairOpen(true);
                          setField("pair", event.target.value);
                        }}
                        onFocus={() => setPairOpen(true)}
                        className="w-full bg-secondary/60 border border-border rounded-lg px-3 py-2 text-sm outline-none"
                      />

                      <button
                        type="button"
                        onClick={() => setPairOpen((value) => !value)}
                        className="absolute right-2 top-2"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>

                    {pairOpen && (
                      <div className="absolute top-full z-20 mt-1 w-full rounded-xl border border-border bg-card shadow-2xl p-1 max-h-48 overflow-auto">
                        {matchingAssets.map((asset) => (
                          <button
                            key={asset.symbol}
                            type="button"
                            onClick={() => choosePair(asset.symbol)}
                            className="w-full flex justify-between rounded-lg px-3 py-2 text-left hover:bg-secondary"
                          >
                            <span>{asset.symbol}</span>

                            <span className="text-[10px] text-muted-foreground">
                              {asset.market}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Account
                    </span>

                    <select
                      value={form.accountId}
                      onChange={(event) =>
                        setField("accountId", event.target.value)
                      }
                      disabled={Boolean(editing)}
                      className="bg-secondary/60 border border-border rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-60"
                    >
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Market
                    </span>

                    <input
                      value={form.market}
                      readOnly
                      className="bg-secondary/40 border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground"
                    />
                  </label>

                  {select("direction", "Direction", ["Long", "Short"])}
                  {select("session", "Session", SESSIONS)}

                  {input("entry", "Entry")}
                  {input("stop", "Stop")}
                  {input("tp", "Take profit")}
                  {input("exit_price", "Exit")}
                  {input("risk_pct", "Risk %", "number")}
                  {input("result_usd", "P&L $", "number")}
                  {input("result_r", "R", "number")}
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-secondary/20 p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold">Context</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Сетап, емоція, HTF bias та нотатки.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {select("setup", "Setup", [
                    "",
                    "Retest",
                    "Breakout",
                    "Divergence",
                    "FVG",
                    "OB",
                    "Other",
                  ])}

                  {select("htf_bias", "HTF bias", [
                    "",
                    "Bullish",
                    "Bearish",
                    "Neutral",
                  ])}

                  {select("emotion", "Emotion", [
                    "",
                    "Calm",
                    "Neutral",
                    "Fear",
                    "Greed",
                    "FOMO",
                    "Confident",
                  ])}

                  {input("entry_reason", "Entry reason")}

                  <div className="col-span-2">
                    {input("exit_reason", "Exit reason")}
                  </div>

                  <div className="col-span-2">
                    {input("mistake", "Mistake")}
                  </div>

                  <div className="col-span-2">
                    {input("screenshot", "Screenshot URL")}
                  </div>

                  <label className="col-span-2 flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Notes
                    </span>

                    <textarea
                      value={form.notes}
                      onChange={(event) =>
                        setField("notes", event.target.value)
                      }
                      rows={5}
                      className="bg-secondary/60 border border-border rounded-lg px-3 py-2 text-sm resize-none outline-none"
                    />
                  </label>
                </div>
              </section>
            </div>

            <footer className="border-t border-border p-4 flex justify-end gap-2">
              <button
                onClick={closeForm}
                className="px-4 py-2 rounded-lg border border-border text-sm"
              >
                Cancel
              </button>

              <button
                onClick={save}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
              >
                {editing ? "Save changes" : "Add trade"}
              </button>
            </footer>
          </aside>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <div className="flex gap-3">
              <div
                className="p-2 rounded-full"
                style={{ background: NEG_BG, color: NEG }}
              >
                <AlertTriangle className="w-4 h-4" />
              </div>

              <div>
                <h3 className="text-sm font-semibold">Видалити угоду?</h3>

                <p className="mt-1 text-sm text-muted-foreground">
                  {confirmDelete.pair} від {confirmDelete.date} буде
                  видалена.
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm border border-border rounded-lg"
              >
                Cancel
              </button>

              <button
                onClick={remove}
                className="px-4 py-2 text-sm rounded-lg"
                style={{ background: NEG_BG, color: NEG }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDelete && (
        <div className="fixed bottom-5 right-5 z-[70] flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-2xl">
          <div>
            <p className="text-sm font-medium">Угоду видалено</p>

            <p className="text-xs text-muted-foreground">
              {pendingDelete.pair} · {pendingDelete.date}
            </p>
          </div>

          <button
            onClick={undo}
            className="text-sm font-semibold"
            style={{ color: POS }}
          >
            Undo
          </button>

          <button
            onClick={() => {
              if (timer.current) clearTimeout(timer.current);
              deleteTrade(pendingDelete.id);
              setPendingDelete(null);
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}