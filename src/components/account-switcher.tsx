"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  Check,
  CheckSquare,
  ChevronDown,
  Crown,
  Layers3,
  Plus,
  Radio,
  Square,
  Trash2,
  Wallet2,
  X,
} from "lucide-react";

import { useTrades } from "@/hooks/use-trades";
import { useMt5 } from "@/hooks/use-mt5";
import {
  kindLabel,
  type AccountKind,
  type TradingAccount,
} from "@/lib/account-data";
import { fmt } from "@/lib/utils-trade";

function currencyAmount(value: number, currency: "USD" | "USDT") {
  return `${fmt.num(value)} ${currency}`;
}

const COLORS = [
  "#4f8cff",
  "#22c55e",
  "#f97316",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
];

type SelectOption<T extends string> = {
  value: T;
  label: string;
};

function Select<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((x) => !x)}
        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white"
      >
        <span>{options.find((x) => x.value === value)?.label}</span>
        <ChevronDown className="h-4 w-4 text-white/55" />
      </button>

      {open ? (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-[#0f1318] shadow-2xl">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10"
            >
              <span>{option.label}</span>
              {option.value === value ? <Check className="h-4 w-4" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function KindCard({
  active,
  title,
  description,
  icon,
  badge,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        active
          ? "border-emerald-400/60 bg-emerald-400/10"
          : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-white">
          {icon}
          <span className="font-medium">{title}</span>
        </div>
        {badge ? (
          <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-amber-200">
            {badge}
          </span>
        ) : null}
      </div>
      <p className="text-sm leading-6 text-white/55">{description}</p>
    </button>
  );
}

function NewAccountModal({
  onClose,
  onCreate,
  mt5DefaultLogin,
  mt5DefaultServer,
  mt5DefaultBalance,
  mt5BridgeConnected,
}: {
  onClose: () => void;
  onCreate: (account: {
    name: string;
    broker?: string;
    platform: "manual" | "mt5";
    source: "manual" | "mt5";
    kind: AccountKind;
    currency: "USD" | "USDT";
    initialBalance: number;
    mt5Login?: string;
    mt5Server?: string;
    color: string;
  }) => Promise<void> | void;
  mt5DefaultLogin?: string;
  mt5DefaultServer?: string;
  mt5DefaultBalance?: number;
  mt5BridgeConnected: boolean;
}) {
  const [kind, setKind] = useState<AccountKind>("manual");
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<"USD" | "USDT">("USD");
  const [balance, setBalance] = useState(
    mt5DefaultBalance && mt5DefaultBalance > 0
      ? String(mt5DefaultBalance)
      : "1000",
  );
  const [mt5Login, setMt5Login] = useState(mt5DefaultLogin ?? "");
  const [mt5Server, setMt5Server] = useState(mt5DefaultServer ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => {
    if (kind === "manual") return "Create manual account";
    if (kind === "mt5_bridge") return "Connect MT5 bridge account";
    return "Sync via API";
  }, [kind]);

  async function create() {
    setError(null);

    if (kind === "sync_api") {
      setError("Sync via API will be available in Pro.");
      return;
    }

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    const initialBalance = Number(balance);
    if (!Number.isFinite(initialBalance) || initialBalance < 0) {
      setError("Starting balance must be a valid number");
      return;
    }

    if (kind === "mt5_bridge" && !mt5Login.trim()) {
      setError("MT5 login is required");
      return;
    }

    try {
      setSubmitting(true);

      await onCreate({
        name: name.trim(),
        broker: kind === "mt5_bridge" ? mt5Server.trim() || "MT5" : "",
        platform: kind === "manual" ? "manual" : "mt5",
        source: kind === "manual" ? "manual" : "mt5",
        kind,
        currency,
        initialBalance,
        mt5Login: kind === "mt5_bridge" ? mt5Login.trim() : undefined,
        mt5Server: kind === "mt5_bridge" ? mt5Server.trim() : undefined,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      });

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save account");
    } finally {
      setSubmitting(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-[#0d1117] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-[11px] uppercase tracking-[0.22em] text-white/35">
              Trading account
            </p>
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            <p className="mt-2 text-sm text-white/55">
              Create a manual journal, link an MT5 bridge account, or preview
              direct sync.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 p-2 text-white/60 hover:bg-white/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-6 grid gap-3 md:grid-cols-3">
          <KindCard
            active={kind === "manual"}
            title="Manual journal"
            description="Best for manual entries, replay sessions, and backtesting."
            icon={<Wallet2 className="h-4 w-4" />}
            onClick={() => setKind("manual")}
          />
          <KindCard
            active={kind === "mt5_bridge"}
            title="MT5 bridge"
            description="Save MT5 login/server and connect through the local bridge."
            icon={<Activity className="h-4 w-4" />}
            onClick={() => setKind("mt5_bridge")}
          />
          <KindCard
            active={kind === "sync_api"}
            title="Sync via API"
            description="Direct account sync and auto-import for subscribers."
            icon={<Crown className="h-4 w-4" />}
            badge="Pro"
            onClick={() => setKind("sync_api")}
          />
        </div>

        {kind === "sync_api" ? (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
            <p className="text-sm font-medium text-amber-100">Coming soon</p>
            <p className="mt-2 text-sm leading-6 text-amber-100/75">
              Direct broker sync is not connected to the current database schema
              yet. For now, use Manual journal or MT5 bridge.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                Name
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  kind === "manual" ? "Backtest account" : "FTMO 10k"
                }
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/50"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                Currency
              </span>
              <Select
                value={currency}
                onChange={setCurrency}
                options={[
                  { value: "USD", label: "USD" },
                  { value: "USDT", label: "USDT" },
                ]}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                Starting balance
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/50"
              />
            </label>

            {kind === "mt5_bridge" ? (
              <>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                    MT5 login
                  </span>
                  <input
                    value={mt5Login}
                    onChange={(e) => setMt5Login(e.target.value)}
                    placeholder="12345678"
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/50"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                    Server
                  </span>
                  <input
                    value={mt5Server}
                    onChange={(e) => setMt5Server(e.target.value)}
                    placeholder="MetaQuotes-Demo"
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/50"
                  />
                </label>

                <div className="md:col-span-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-white">
                    <Activity className="h-4 w-4 text-emerald-300" />
                    <span>Bridge status</span>
                  </div>
                  <p className="mt-2 text-sm text-white/55">
                    {mt5BridgeConnected
                      ? "Bridge is online. Login and server can be prefilled from the current terminal."
                      : "Bridge is offline. You can still save the MT5 account profile manually."}
                  </p>
                </div>
              </>
            ) : null}
          </div>
        )}

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void create()}
            disabled={submitting || kind === "sync_api"}
            className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? "Saving..."
              : kind === "manual"
                ? "Create account"
                : "Save MT5 account"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Mt5Panel() {
  const { health, positions, loading, refresh } = useMt5();
  const pnl = positions.reduce(
    (sum, position) => sum + position.profit + position.swap,
    0,
  );
  const currency = health.currency || "USD";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white">MT5 terminal</p>
          <p className="mt-1 text-xs text-white/50">
            {loading
              ? "Connecting..."
              : health.connected
                ? `${health.login ?? "—"} · ${health.server ?? "Connected"}`
                : "Bridge offline"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-white/55"
        >
          Refresh
        </button>
      </div>

      {health.connected ? (
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">
              Balance
            </p>
            <p className="mt-1 text-sm text-white">
              {currencyAmount(health.balance ?? 0, currency as "USD" | "USDT")}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">
              Equity
            </p>
            <p className="mt-1 text-sm text-white">
              {currencyAmount(health.equity ?? 0, currency as "USD" | "USDT")}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">
              Open positions
            </p>
            <p className="mt-1 text-sm text-white">
              {positions.length} ·{" "}
              <span className={pnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                {pnl >= 0 ? "+" : ""}
                {fmt.num(pnl)} {currency}
              </span>
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-white/55">
          Run the MT5 bridge on 127.0.0.1:8787 to detect the current terminal
          automatically.
        </p>
      )}
    </div>
  );
}

export default function AccountSwitcher() {
  const {
    accounts,
    activeAccountId,
    activeAccount,
    setActiveAccountId,
    includedAccountIds,
    toggleAccountIncluded,
    deleteAccount,
    upsertAccount,
  } = useTrades();

  const { health, initialDeposit } = useMt5();
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(false);

  const label =
    activeAccountId === "all"
      ? {
          title: "All accounts",
          sub: `${includedAccountIds.length} included`,
          color: "#4f8cff",
          icon: <Layers3 className="h-4 w-4 text-white" />,
        }
      : activeAccount
        ? {
            title: activeAccount.name,
            sub: currencyAmount(
              activeAccount.initialBalance,
              activeAccount.currency,
            ),
            color: activeAccount.color,
            icon: <Wallet2 className="h-4 w-4 text-white" />,
          }
        : {
            title: "Select account",
            sub: "No account selected",
            color: "#7c8cff",
            icon: <Wallet2 className="h-4 w-4 text-white" />,
          };

  async function linkCurrentMt5() {
    if (!health.login) return;

    const login = String(health.login);
    const existing = accounts.find((account) => account.mt5Login === login);
    const balance =
      initialDeposit && initialDeposit > 0
        ? initialDeposit
        : (existing?.initialBalance ?? 0);
    if (balance <= 0) return;

    const saved = await upsertAccount({
      id: existing?.id,
      name: existing?.name || `${health.server || "MT5"} · ${login}`,
      broker: health.server || "MT5",
      platform: "mt5",
      source: "mt5",
      kind: "mt5_bridge",
      currency: health.currency === "USDT" ? "USDT" : "USD",
      initialBalance: balance,
      mt5Login: login,
      mt5Server: health.server || undefined,
      color: existing?.color ?? "#22c55e",
      status: existing?.status ?? "active",
    });

    setActiveAccountId(saved.id);
    setOpen(false);
  }

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((x) => !x)}
          className="flex min-w-[220px] items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#11151b]/95 px-3 py-2.5 text-left"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${label.color}22` }}
            >
              {label.icon}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-white">
                {label.title}
              </div>
              <div className="truncate text-xs text-white/50">{label.sub}</div>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-white/45" />
        </button>

        {open ? (
          <>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-30 cursor-default"
            />

            <div className="absolute right-0 z-40 mt-3 w-[380px] rounded-[28px] border border-white/10 bg-[#0d1117] p-4 shadow-2xl">
              <div className="mb-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/35">
                  Trading account manager
                </p>
                <p className="mt-2 text-sm text-white/60">
                  Choose active profile, include accounts in dashboard totals,
                  or save MT5 profiles.
                </p>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveAccountId("all");
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left ${
                    activeAccountId === "all"
                      ? "bg-white/10"
                      : "hover:bg-white/5"
                  }`}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#4f8cff22]">
                    <Layers3 className="h-4 w-4 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-white">
                      All accounts
                    </div>
                    <div className="text-xs text-white/50">
                      Combined · {includedAccountIds.length} included
                    </div>
                  </div>
                  {activeAccountId === "all" ? (
                    <Check className="h-4 w-4 text-emerald-300" />
                  ) : null}
                </button>

                {accounts.map((account) => {
                  const included = includedAccountIds.includes(account.id);

                  return (
                    <div
                      key={account.id}
                      className="flex items-center gap-2 rounded-2xl px-2 py-2 hover:bg-white/[0.03]"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActiveAccountId(account.id);
                          setOpen(false);
                        }}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded-xl"
                          style={{ backgroundColor: `${account.color}22` }}
                        >
                          <Wallet2 className="h-4 w-4 text-white" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-white">
                            {account.name}
                          </div>
                          <div className="truncate text-xs text-white/50">
                            {kindLabel[account.kind]} ·{" "}
                            {currencyAmount(
                              account.initialBalance,
                              account.currency,
                            )}
                          </div>
                        </div>

                        {activeAccountId === account.id ? (
                          <Check className="h-4 w-4 text-emerald-300" />
                        ) : null}
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleAccountIncluded(account.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 text-white/65 hover:bg-white/5"
                      >
                        {included ? (
                          <CheckSquare className="h-4 w-4" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => void deleteAccount(account.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-[#24151a] text-red-400 hover:bg-[#32181f]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="my-4 border-t border-white/10" />

              <Mt5Panel />

              <div className="mt-4 grid gap-2">
                <button
                  type="button"
                  disabled={!health.connected}
                  onClick={() => void linkCurrentMt5()}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left disabled:opacity-50"
                >
                  <div>
                    <div className="text-sm font-medium text-white">
                      {health.connected
                        ? "Link current MT5 terminal"
                        : "MT5 terminal offline"}
                    </div>
                    <div className="mt-1 text-xs text-white/50">
                      Initial deposit:{" "}
                      {initialDeposit
                        ? currencyAmount(
                            initialDeposit,
                            health.currency === "USDT" ? "USDT" : "USD",
                          )
                        : "waiting for history"}
                    </div>
                  </div>
                  <Radio className="h-4 w-4 text-white/50" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setModal(true);
                  }}
                  className="flex items-center justify-between rounded-2xl border border-dashed border-white/15 px-4 py-3 text-left text-white/70 hover:bg-white/[0.03]"
                >
                  <div>
                    <div className="text-sm font-medium text-white">
                      New account
                    </div>
                    <div className="mt-1 text-xs text-white/50">
                      Manual journal, MT5 bridge profile, or API sync preview
                    </div>
                  </div>
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {modal ? (
        <NewAccountModal
          onClose={() => setModal(false)}
          mt5DefaultLogin={health.login ? String(health.login) : ""}
          mt5DefaultServer={health.server ?? ""}
          mt5DefaultBalance={initialDeposit ?? undefined}
          mt5BridgeConnected={Boolean(health.connected)}
          onCreate={async (account) => {
            const saved = await upsertAccount(account);
            setActiveAccountId(saved.id);
          }}
        />
      ) : null}
    </>
  );
}
