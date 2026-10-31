"use client";
import { dialogSurface, DIALOG_BACKDROP } from "@/components/ui/dialog-styles";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ChevronDown, X } from "lucide-react";
import { type JournalTrade, type TradeInput } from "@/hooks/use-trades";
import type { TradingAccount } from "@/lib/account-data";
import { Button, Input, Panel, Select, Textarea } from "@/components/ui/primitives";
import { Field } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import "@/components/ui/field.css";
import { useInstruments } from "@/hooks/use-instruments";
import {
  marketForSymbol as findMarket,
  type Instrument,
} from "@/lib/instruments";
import { marketsFrom, sortBySymbol } from "@/lib/markets";

const SESSIONS = ["Asia", "London", "NY", "Overlap"] as const;

type RequiredField =
  | "opened_at"
  | "symbol"
  | "direction"
  | "entry_price"
  | "exit_price";

type WarningField = "risk_percent" | "gross_pnl";

type FormErrors = Partial<Record<RequiredField, string>>;

type FormTrade = {
  account_id: string;
  source: "manual";
  opened_at: string;
  closed_at: string;
  symbol: string;
  market: string;
  direction: "Long" | "Short" | "";
  entry_price: string;
  stop_loss: string;
  take_profit: string;
  exit_price: string;
  volume: string;
  risk_percent: string;
  risk_amount: string;
  gross_pnl: string;
  commission: string;
  swap: string;
  fee: string;
  session: string;
  setup: string;
  htf_bias: string;
  entry_reason: string;
  exit_reason: string;
  emotion: string;
  mistake: string;
  screenshot_url: string;
  notes: string;
};

type ManualTradeSubmit = TradeInput | (TradeInput & { id: string });

type ManualTradeModalProps = {
  open: boolean;
  accounts: TradingAccount[];
  defaultAccountId?: string;
  initialTrade?: JournalTrade | null;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (values: ManualTradeSubmit) => Promise<void> | void;
};

const FIELD_NAMES: Record<RequiredField, string> = {
  opened_at: "Opened at",
  symbol: "Symbol",
  direction: "Direction",
  entry_price: "Entry price",
  exit_price: "Exit price",
};

const shakeStyle: CSSProperties = {
  animation: "trade-ticket-shake 380ms ease-in-out",
};

function marketForSymbol(list: Instrument[], symbol: string) {
  return findMarket(list, symbol);
}

function sessionForTime(time: string) {
  if (!time.includes(":")) return "";

  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return "";

  const total = h * 60 + m;
  if (total < 8 * 60) return "Asia";
  if (total < 13 * 60) return "London";
  if (total < 17 * 60) return "Overlap";
  return "NY";
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function toIsoString(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function timeFromDateTimeLocal(value: string) {
  if (!value.includes("T")) return "";
  return value.split("T")[1]?.slice(0, 5) ?? "";
}

function toNullableNumber(value: string) {
  if (!String(value).trim()) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function absCost(value: string) {
  return Math.abs(toNullableNumber(value) ?? 0);
}

// net = gross - (commission + swap + fee); costs are always positive amounts.
function computeNetPnl(form: FormTrade) {
  const gross = toNullableNumber(form.gross_pnl) ?? 0;
  const swap = toNullableNumber(form.swap) ?? 0;
  const costs = absCost(form.commission) + absCost(form.fee);
  return Math.round((gross - costs + swap) * 1e8) / 1e8;
}

// Realized R = price result / initial risk distance (entry -> stop loss).
function computeR(form: FormTrade): number | null {
  const entry = toNullableNumber(form.entry_price);
  const exit = toNullableNumber(form.exit_price);
  const stop = toNullableNumber(form.stop_loss);

  if (entry === null || exit === null || stop === null) return null;
  if (form.direction !== "Long" && form.direction !== "Short") return null;

  const risk = form.direction === "Long" ? entry - stop : stop - entry;
  if (!(risk > 0)) return null;

  const move = form.direction === "Long" ? exit - entry : entry - exit;
  return Math.round((move / risk) * 10000) / 10000;
}

function buildInitialForm(
  accounts: TradingAccount[],
  defaultAccountId?: string,
): FormTrade {
  return {
    account_id: defaultAccountId || accounts[0]?.id || "",
    source: "manual",
    opened_at: "",
    closed_at: "",
    symbol: "",
    market: "",
    direction: "Long",
    entry_price: "",
    stop_loss: "",
    take_profit: "",
    exit_price: "",
    volume: "",
    risk_percent: "",
    risk_amount: "",
    gross_pnl: "",
    commission: "0",
    swap: "0",
    fee: "0",
    session: "",
    setup: "",
    htf_bias: "",
    entry_reason: "",
    exit_reason: "",
    emotion: "",
    mistake: "",
    screenshot_url: "",
    notes: "",
  };
}

function costToString(value: number | null | undefined) {
  return value == null ? "0" : String(Math.abs(value));
}

function formFromTrade(trade: JournalTrade): FormTrade {
  return {
    account_id: trade.account_id ?? "",
    source: "manual",
    opened_at: toDateTimeLocal(trade.opened_at),
    closed_at: toDateTimeLocal(trade.closed_at),
    symbol: trade.symbol ?? "",
    market: trade.market ?? "",
    direction: trade.direction === "Short" ? "Short" : "Long",
    entry_price: trade.entry_price == null ? "" : String(trade.entry_price),
    stop_loss: trade.stop_loss == null ? "" : String(trade.stop_loss),
    take_profit: trade.take_profit == null ? "" : String(trade.take_profit),
    exit_price: trade.exit_price == null ? "" : String(trade.exit_price),
    volume: trade.volume == null ? "" : String(trade.volume),
    risk_percent: trade.risk_percent == null ? "" : String(trade.risk_percent),
    risk_amount: trade.risk_amount == null ? "" : String(trade.risk_amount),
    gross_pnl: trade.gross_pnl == null ? "" : String(trade.gross_pnl),
    commission: costToString(trade.commission),
    swap: trade.swap == null ? "0" : String(trade.swap),
    fee: costToString(trade.fee),
    session: trade.session ?? "",
    setup: trade.setup ?? "",
    htf_bias: trade.htf_bias ?? "",
    entry_reason: trade.entry_reason ?? "",
    exit_reason: trade.exit_reason ?? "",
    emotion: trade.emotion ?? "",
    mistake: trade.mistake ?? "",
    screenshot_url: trade.screenshot_url ?? "",
    notes: trade.notes ?? "",
  };
}

export function ManualTradeModal({
  open,
  accounts,
  defaultAccountId,
  initialTrade = null,
  submitting = false,
  onClose,
  onSubmit,
}: ManualTradeModalProps) {
  const [form, setForm] = useState<FormTrade>(
    buildInitialForm(accounts, defaultAccountId),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [warningFields, setWarningFields] = useState<Set<WarningField>>(
    new Set(),
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [shakeSubmit, setShakeSubmit] = useState(false);
  const [symbolQuery, setSymbolQuery] = useState("");
  const [symbolOpen, setSymbolOpen] = useState(false);
  const [marketFilter, setMarketFilter] = useState<string>("All");
  const { instruments } = useInstruments();
  const marketOptions = useMemo(
    () => marketsFrom(instruments.map((i) => i.market)),
    [instruments],
  );

  useEffect(() => {
    if (!open) return;

    if (initialTrade) {
      setForm(formFromTrade(initialTrade));
      setSymbolQuery(initialTrade.symbol ?? "");
    } else {
      setForm(buildInitialForm(accounts, defaultAccountId));
      setSymbolQuery("");
    }

    setSymbolOpen(false);
    setMarketFilter("All");
    setErrors({});
    setWarningFields(new Set());
    setSubmitError(null);
    setShakeSubmit(false);
  }, [open, initialTrade, accounts, defaultAccountId]);

  const matchingAssets = useMemo(() => {
    const q = symbolQuery.trim().toLowerCase();
    const byMarket =
      marketFilter === "All"
        ? instruments
        : instruments.filter((item) => item.market === marketFilter);
    const bySearch = q
      ? byMarket.filter(
          (item) =>
            item.symbol.toLowerCase().includes(q) ||
            item.displaySymbol.toLowerCase().includes(q) ||
            item.market.toLowerCase().includes(q),
        )
      : byMarket;
    return sortBySymbol(bySearch);
  }, [symbolQuery, instruments, marketFilter]);

  const netPreview = useMemo(() => String(computeNetPnl(form)), [form]);
  const rPreview = useMemo(() => {
    const r = computeR(form);
    return r === null ? "—" : String(r);
  }, [form]);

  if (!open) return null;

  function chooseSymbol(symbol: string) {
    setForm((previous) => ({
      ...previous,
      symbol,
      market: marketForSymbol(instruments, symbol) || previous.market,
    }));
    setSymbolQuery(symbol);

    setErrors((previous) => {
      const next = { ...previous };
      delete next.symbol;
      return next;
    });

    setSymbolOpen(false);
  }

  function changeOpenedAt(value: string) {
    setForm((previous) => ({
      ...previous,
      opened_at: value,
      session: sessionForTime(timeFromDateTimeLocal(value)) || previous.session,
    }));

    setErrors((previous) => {
      const next = { ...previous };
      delete next.opened_at;
      return next;
    });
  }

  function setField<K extends keyof FormTrade>(key: K, value: FormTrade[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));

    setErrors((previous) => {
      const next = { ...previous };
      delete next[key as RequiredField];
      return next;
    });

    if (key === "risk_percent" || key === "gross_pnl") {
      setWarningFields((previous) => {
        const next = new Set(previous);
        next.delete(key as WarningField);
        return next;
      });
    }
  }

  async function save() {
    const next: FormErrors = {};

    if (!form.account_id.trim()) {
      setSubmitError("Account is required");
      return;
    }

    if (!form.opened_at.trim()) next.opened_at = "Required";
    if (!form.symbol.trim()) next.symbol = "Required";
    if (form.direction !== "Long" && form.direction !== "Short") {
      next.direction = "Long / Short";
    }
    if (!form.entry_price.trim() || Number(form.entry_price) <= 0) {
      next.entry_price = "Required";
    }
    if (!form.exit_price.trim() || Number(form.exit_price) <= 0) {
      next.exit_price = "Required";
    }

    const warnings = new Set<WarningField>();
    if (!String(form.risk_percent).trim() || Number(form.risk_percent) <= 0) {
      warnings.add("risk_percent");
    }
    if (!String(form.gross_pnl).trim()) warnings.add("gross_pnl");
    setWarningFields(warnings);

    if (Object.keys(next).length) {
      setErrors(next);
      setSubmitError(
        Object.keys(next)
          .map((key) => FIELD_NAMES[key as RequiredField])
          .join(", "),
      );
      setShakeSubmit(true);
      window.setTimeout(() => setShakeSubmit(false), 400);

      const first = Object.keys(next)[0];
      window.setTimeout(() => {
        document
          .querySelector<HTMLElement>(`[data-trade-field="${first}"]`)
          ?.focus();
      }, 0);
      return;
    }

    const payloadBase: TradeInput = {
      account_id: form.account_id,
      source: "manual",
      opened_at: toIsoString(form.opened_at),
      closed_at: form.closed_at ? toIsoString(form.closed_at) : null,
      symbol: form.symbol,
      market: form.market || marketForSymbol(instruments, form.symbol) || null,
      direction: form.direction as "Long" | "Short",
      entry_price: form.entry_price || null,
      stop_loss: form.stop_loss || null,
      take_profit: form.take_profit || null,
      exit_price: form.exit_price || null,
      volume: toNullableNumber(form.volume),
      risk_percent: toNullableNumber(form.risk_percent),
      risk_amount: toNullableNumber(form.risk_amount),
      gross_pnl: toNullableNumber(form.gross_pnl) ?? 0,
      commission: absCost(form.commission),
      swap: toNullableNumber(form.swap) ?? 0,
      fee: absCost(form.fee),
      session:
        form.session ||
        sessionForTime(timeFromDateTimeLocal(form.opened_at)) ||
        null,
      setup: form.setup || null,
      htf_bias: form.htf_bias || null,
      entry_reason: form.entry_reason || null,
      exit_reason: form.exit_reason || null,
      emotion: form.emotion || null,
      mistake: form.mistake || null,
      screenshot_url: form.screenshot_url || null,
      notes: form.notes || null,
    };

    try {
      setSubmitError(null);
      if (initialTrade?.id) {
        await onSubmit({ ...payloadBase, id: initialTrade.id });
      } else {
        await onSubmit(payloadBase);
      }
      onClose();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to save trade",
      );
      setShakeSubmit(true);
      window.setTimeout(() => setShakeSubmit(false), 400);
    }
  }

  function input(key: keyof FormTrade, label: string, type = "text") {
  const error = errors[key as RequiredField];
  const warning = warningFields.has(key as WarningField);
  return <Field label={label} error={error} warning={warning ? "Optional, but recommended." : undefined}>{control => <Input {...control} data-trade-field={key} type={type} value={String(form[key] ?? "")} onChange={event => setField(key, event.target.value as never)} className="ui-field-control" />}</Field>;
  }
  function readOnly(label: string, value: string) {
  return <Field label={label}>{control => <Input {...control} value={value} readOnly tabIndex={-1} aria-readonly="true" className="ui-field-control" />}</Field>;
  }

  function select(
    key: keyof FormTrade,
    label: string,
    values: readonly string[],
  ) {
    const error = errors[key as RequiredField];

    return (
      <label className="flex flex-col gap-1 min-w-0 relative">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
          {label}
        </span>
        <Select
          className="ui-field-control"
          data-ui-state={error ? "error" : undefined}
          aria-invalid={Boolean(error)}
          aria-label={label}
          value={String(form[key] ?? "")}
          onChange={(event) => setField(key, event.target.value as never)}
        >
          <option value="" disabled>
            {label}
          </option>
          {values.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
        {error ? (
          <span className="text-[11px] text-destructive">{error}</span>
        ) : null}
      </label>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <style>{`
        @keyframes trade-ticket-shake {
          0%,100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          50% { transform: translateX(6px); }
          75% { transform: translateX(-3px); }
        }
      `}</style>

      <div
        className={`${DIALOG_BACKDROP} absolute inset-0`}
        onClick={onClose}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={initialTrade ? "Edit trade" : "Add trade"}
        className={dialogSurface("relative z-10 flex w-full max-w-4xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[min(820px,calc(100dvh-3rem))] flex-col overflow-hidden")}
      >
        <header className="border-b border-border bg-panel px-5 py-4 flex justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[.18em] text-muted-foreground">
              Trade ticket
            </p>
            <h2 className="font-semibold mt-1">
              {initialTrade ? "Edit trade" : "Add trade"}
            </h2>
          </div>

          <button type="button" onClick={onClose} aria-label="Close modal">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-card">
          <Panel className="p-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold">Execution</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Commission and fee are positive costs. Swap is signed: negative
                = charge, positive = credit.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                  Opened at
                </span>
                <Input
                  data-trade-field="opened_at"
                  type="datetime-local"
                  value={form.opened_at}
                  onChange={(event) => changeOpenedAt(event.target.value)} className="ui-field-control" data-ui-state={errors.opened_at ? 'error' : undefined} aria-invalid={Boolean(errors.opened_at)}
                />
                {errors.opened_at ? (
                  <span className="text-[11px] text-destructive">
                    {errors.opened_at}
                  </span>
                ) : null}
              </label>

              {input("closed_at", "Closed at", "datetime-local")}

              <label className="col-span-2 flex flex-col gap-1 relative">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                  Symbol
                </span>

                <div className="relative">
                  <Input
                    data-trade-field="symbol"
                    value={symbolQuery}
                    onChange={(event) => {
                      const value = event.target.value;
                      setSymbolQuery(value);
                      setSymbolOpen(true);
                      setField("symbol", value);
                    }}
                    onFocus={() => setSymbolOpen(true)} className="ui-field-control" data-ui-state={errors.symbol ? 'error' : undefined} aria-invalid={Boolean(errors.symbol)}
                  />
                  <button
                    type="button"
                    onClick={() => setSymbolOpen((value) => !value)}
                    className="absolute right-2 top-2"
                    aria-label="Toggle symbol list"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>

                  {symbolOpen ? (
                    <div className="absolute top-full z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
                      <div className="flex flex-wrap gap-1.5 border-b border-border p-2">
                        {["All", ...marketOptions].map((value) => (
                          <button
                            key={value}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => setMarketFilter(value)}
                            className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                              marketFilter === value
                                ? "border-primary/20 bg-primary/10 text-primary"
                                : "border-border bg-secondary/60 text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {value}
                          </button>
                        ))}
                      </div>
                      <div className="max-h-56 overflow-auto p-1">
                        {matchingAssets.length === 0 ? (
                          <EmptyState title="No symbols found" className="px-3 py-4" />
                        ) : (
                          matchingAssets.map((asset) => (
                            <button
                              key={asset.symbol}
                              type="button"
                              onClick={() => chooseSymbol(asset.symbol)}
                              className="flex w-full justify-between rounded-lg px-3 py-2 text-left hover:bg-secondary"
                            >
                              <span>{asset.symbol}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {asset.market}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>

                {errors.symbol ? (
                  <span className="text-[11px] text-destructive">
                    {errors.symbol}
                  </span>
                ) : null}
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                  Account
                </span>
                <Select
                  value={form.account_id}
                  onChange={(event) =>
                    setField("account_id", event.target.value)
                  }
                  className="ui-field-control"
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </Select>
              </label>

              {readOnly("Market", form.market)}

              {select("direction", "Direction", ["Long", "Short"])}
              {select("session", "Session", SESSIONS)}
              {input("entry_price", "Entry price", "number")}
              {input("stop_loss", "Stop loss", "number")}
              {input("take_profit", "Take profit", "number")}
              {input("exit_price", "Exit price", "number")}
              {input("volume", "Volume", "number")}
              {input("risk_percent", "Risk %", "number")}
              {input("risk_amount", "Risk amount", "number")}
              {input("gross_pnl", "Gross P/L", "number")}
              {input("commission", "Commission", "number")}
              {input("swap", "Swap (+ / −)", "number")}
              {input("fee", "Fee", "number")}
              {readOnly("Net P/L (auto)", netPreview)}
              {readOnly("R (auto)", rPreview)}
            </div>
          </Panel>

          <Panel className="p-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold">Context</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Session, setup, emotion, reasons and notes.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {select("setup", "Setup", [
                "Retest",
                "Breakout",
                "Divergence",
                "FVG",
                "OB",
                "Other",
              ])}
              {select("htf_bias", "HTF bias", [
                "Bullish",
                "Bearish",
                "Neutral",
              ])}
              {select("emotion", "Emotion", [
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
              <div className="col-span-2">{input("mistake", "Mistake")}</div>
              <div className="col-span-2">
                {input("screenshot_url", "Screenshot URL")}
              </div>

              <label className="col-span-2 flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                  Notes
                </span>
                <Textarea
                  value={form.notes}
                  onChange={(event) => setField("notes", event.target.value)}
                  rows={5}
                  className="ui-field-control"
                />
              </label>
            </div>
          </Panel>
        </div>

        <footer className="border-t border-border bg-panel p-4 flex items-center justify-end gap-2">
          {submitError ? (
            <p role="alert" className="mr-auto text-xs text-destructive">
              {submitError}
            </p>
          ) : null}

          <Button variant="secondary"
            type="button"
            onClick={onClose}

          >
            Cancel
          </Button>

          <Button loading={submitting}
            type="button"
            onClick={() => void save()}
            disabled={submitting}
            style={shakeSubmit ? shakeStyle : undefined}

          >
            {initialTrade ? "Save changes" : "Add trade"}
          </Button>
        </footer>
      </aside>
    </div>
  );
}
