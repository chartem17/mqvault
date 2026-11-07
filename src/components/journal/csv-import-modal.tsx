"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import { FileUp, X } from "lucide-react";
import { Button, Select } from "@/components/ui/primitives";
import { dialogSurface, DIALOG_BACKDROP } from "@/components/ui/dialog-styles";
import { TimezoneSelect } from "@/components/settings/timezone-select";
import { useI18n } from "@/components/providers/i18n-provider";
import { useTimezone } from "@/components/providers/timezone-provider";
import type { TradingAccount } from "@/lib/accounts/account-data";
import { fmt } from "@/lib/journal/utils-trade";
import { formatDateTimeOrDash } from "@/lib/time/timezone";
import { IMPORT_FIELDS, dateOrderFor, detectColumns, parseCsv, rowsToTrades, type ColumnMapping, type DateOrder, type ImportField, type ImportedTrade } from "@/lib/journal/csv-import";

type Props = { open: boolean; accounts: TradingAccount[]; defaultAccountId?: string; onClose: () => void; onImported: () => void };
type Check = { toImport: number; duplicates: number; shifted: number; offsets: number[]; invalid: number };
type Done = { inserted: number; duplicates: number; invalid: number };
const MAX_FILE = 5 * 1024 * 1024;

/** Reads a file as text: UTF-16 (MT5 exports) by BOM, UTF-8 otherwise, Windows-1251 when UTF-8 is broken. */
async function readText(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  return utf8.includes("�") ? new TextDecoder("windows-1251").decode(bytes) : utf8;
}

/** CSV import: the file decides nothing on its own — the user sees the detected columns and a preview before anything is saved. */
export function CsvImportModal({ open, accounts, defaultAccountId, onClose, onImported }: Props) {
  const { t, tn, intl } = useI18n();
  const { timezone: userZone } = useTimezone();
  const [accountId, setAccountId] = useState(defaultAccountId ?? accounts[0]?.id ?? "");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>([]);
  const [dateOrder, setDateOrder] = useState<DateOrder>("dmy");
  const [ambiguous, setAmbiguous] = useState(false);
  const [zone, setZone] = useState("UTC");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState<Check | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [drag, setDrag] = useState(false);

  const account = accounts.find(item => item.id === accountId);
  useEffect(() => { if (open) { setAccountId(current => current || defaultAccountId || accounts[0]?.id || ""); } }, [open, defaultAccountId, accounts]);
  useEffect(() => { setZone(account?.brokerTimezone || "UTC"); setCheck(null); }, [account?.brokerTimezone, accountId]);
  useEffect(() => { setCheck(null); }, [mapping, dateOrder, zone]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) close(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const results = useMemo(() => (headers.length ? rowsToTrades(rows, mapping, { timezone: zone, dateOrder }) : []), [headers.length, rows, mapping, zone, dateOrder]);
  const ready = results.filter(result => result.trade).map(result => result.trade as ImportedTrade);
  const failed = results.filter(result => !result.trade);
  const warned = results.filter(result => result.trade && result.warnings.length);

  function reset() { setFileName(""); setHeaders([]); setRows([]); setMapping([]); setError(null); setCheck(null); setDone(null); }
  function close() { reset(); onClose(); }

  async function load(file: File | undefined) {
    if (!file) return;
    reset();
    if (file.size > MAX_FILE) { setError(t("The file is larger than 5 MB.")); return; }
    try {
      const table = parseCsv(await readText(file));
      if (table.length < 2) { setError(t("The file has no data rows.")); return; }
      const [head, ...data] = table;
      const width = Math.max(...table.map(row => row.length));
      const padded = data.map(row => [...row, ...Array(Math.max(0, width - row.length)).fill("")]);
      const detected = detectColumns(head, padded.slice(0, 50));
      const order = dateOrderFor(padded, detected);
      setFileName(file.name); setHeaders(head); setRows(padded); setMapping(detected); setDateOrder(order.order); setAmbiguous(order.ambiguous);
      if (!detected.includes("symbol") || !detected.includes("direction")) setError(t("Some required columns were not recognised — pick them below."));
    } catch { setError(t("Could not read the file as CSV.")); }
  }

  async function send(dryRun: boolean) {
    if (!accountId || !ready.length) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/journal/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ account_id: accountId, trades: ready, dryRun }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : `Request failed (${response.status})`);
      if (dryRun) setCheck(payload as Check);
      else { setDone(payload as Done); onImported(); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Import failed"); }
    finally { setBusy(false); }
  }

  function setField(column: number, field: ImportField | "") {
    setMapping(current => current.map((value, index) => (index === column ? (field || null) : field && value === field ? null : value)));
  }
  function onDrop(event: DragEvent<HTMLLabelElement>) { event.preventDefault(); setDrag(false); void load(event.dataTransfer.files[0]); }

  if (!open) return null;
  const required: ImportField[] = ["symbol", "direction"];
  const missing = required.filter(field => !mapping.includes(field));
  const noDate = !mapping.some(field => field === "opened_at" || field === "open_date");

  return <div className={`${DIALOG_BACKDROP} fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4`} onClick={() => !busy && close()}>
    <div role="dialog" aria-modal="true" aria-label={t("Import trades from CSV")} className={dialogSurface("flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl")} onClick={event => event.stopPropagation()}>
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <h2 className="m-0 text-lg font-semibold">{t("Import trades from CSV")}</h2>
        <button type="button" aria-label={t("Close")} onClick={close} disabled={busy}><X className="h-5 w-5" /></button>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
        {done ? <div role="status" className="space-y-2 py-6 text-center">
          <p className="m-0 text-2xl font-semibold">{tn(done.inserted, "{count} trade imported", "{count} trades imported")}</p>
          <p className="m-0 text-sm text-muted-foreground">{t("Skipped as already in the journal: {duplicates}. Rejected: {invalid}.", { duplicates: done.duplicates, invalid: done.invalid + failed.length })}</p>
          <p className="m-0 text-sm text-muted-foreground">{t("New trades wait in the day review for setup and emotion.")}</p>
        </div> : <>
          <section className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm"><span className="font-medium">{t("Account")}</span>
              <Select value={accountId} onChange={event => setAccountId(event.target.value)} aria-label={t("Account")}>{accounts.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
            </label>
            <label className="space-y-1.5 text-sm"><span className="font-medium">{t("Time zone of the times in the file")}</span>
              <TimezoneSelect value={zone} onChange={setZone} aria-label={t("Time zone of the times in the file")} />
              <span className="block text-xs text-muted-foreground">{t("Defaults to the broker time zone of the account.")}</span>
            </label>
          </section>

          <label onDragOver={event => { event.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop} className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center text-sm transition-colors ${drag ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
            <FileUp className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <span className="font-medium">{fileName || t("Choose a CSV file or drop it here")}</span>
            <span className="text-xs text-muted-foreground">{fileName ? tn(rows.length, "{count} row", "{count} rows") : t("Any column order and names: MT5, exchanges, your own spreadsheet. Nothing is saved before you confirm.")}</span>
            <input type="file" accept=".csv,.txt,text/csv" className="sr-only" onChange={event => { void load(event.target.files?.[0]); event.target.value = ""; }} />
          </label>

          {error && <div role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{t(error)}</div>}

          {headers.length > 0 && <section aria-label={t("Columns")} className="space-y-2">
            <h3 className="m-0 text-sm font-semibold">{t("Columns")}</h3>
            <p className="m-0 text-xs text-muted-foreground">{t("Recognised automatically. Fix any column if needed; “Skip” ignores it.")}</p>
            <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full text-xs">
              <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="px-3 py-2 font-medium">{t("Column in the file")}</th><th className="px-3 py-2 font-medium">{t("Example")}</th><th className="px-3 py-2 font-medium">{t("Field")}</th></tr></thead>
              <tbody>{headers.map((header, index) => <tr key={index} className="border-b border-border/50">
                <td className="px-3 py-1.5 font-medium">{header || `#${index + 1}`}</td>
                <td className="max-w-[12rem] truncate px-3 py-1.5 text-muted-foreground">{rows.find(row => row[index])?.[index] ?? ""}</td>
                <td className="px-3 py-1.5"><Select aria-label={t("Field for {column}", { column: header || `#${index + 1}` })} value={mapping[index] ?? ""} onChange={event => setField(index, event.target.value as ImportField | "")} className={`min-w-[11rem] ${mapping[index] ? "" : "text-muted-foreground"}`}>
                  <option value="">{t("Skip")}</option>
                  {IMPORT_FIELDS.map(item => <option key={item.field} value={item.field}>{t(item.label)}</option>)}
                </Select></td>
              </tr>)}</tbody>
            </table></div>
            {(missing.length > 0 || noDate) && <p role="alert" className="m-0 text-xs text-destructive">{t("Required: symbol, direction and open date.")}</p>}
            {ambiguous && <label className="flex flex-wrap items-center gap-2 text-xs"><span className="font-medium">{t("Dates like 03/04/2025 mean")}</span>
              <Select value={dateOrder} onChange={event => setDateOrder(event.target.value as DateOrder)} aria-label={t("Date order")} className="w-auto"><option value="dmy">{t("day/month (3 April)")}</option><option value="mdy">{t("month/day (4 March)")}</option></Select>
            </label>}
          </section>}

          {headers.length > 0 && <section aria-label={t("Preview")} className="space-y-2">
            <h3 className="m-0 text-sm font-semibold">{t("Preview")}</h3>
            <p className="m-0 text-xs text-muted-foreground">{t("Ready: {ready} · with errors (skipped): {failed} · with warnings: {warned}. Times are shown in your time zone.", { ready: ready.length, failed: failed.length, warned: warned.length })}</p>
            {ready.length > 0 && <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full whitespace-nowrap text-xs tabular-nums">
              <thead><tr className="border-b border-border text-left text-muted-foreground">{[t("Opened"), t("Symbol"), t("Direction"), t("Entry"), t("Exit"), t("SL"), t("TP"), t("Volume"), t("Profit"), t("Commission")].map(label => <th key={label} className="px-3 py-2 font-medium">{label}</th>)}</tr></thead>
              <tbody>{ready.slice(0, 8).map((trade, index) => <tr key={index} className="border-b border-border/50">
                <td className="px-3 py-1.5">{formatDateTimeOrDash(trade.opened_at, userZone, intl)}</td><td className="px-3 py-1.5">{trade.symbol}</td><td className="px-3 py-1.5">{trade.direction}</td>
                <td className="px-3 py-1.5">{trade.entry_price ?? "—"}</td><td className="px-3 py-1.5">{trade.exit_price ?? "—"}</td><td className="px-3 py-1.5">{trade.stop_loss ?? "—"}</td><td className="px-3 py-1.5">{trade.take_profit ?? "—"}</td>
                <td className="px-3 py-1.5">{trade.volume ?? "—"}</td><td className="px-3 py-1.5">{trade.gross_pnl === null ? "—" : fmt.usd(trade.gross_pnl)}</td><td className="px-3 py-1.5">{trade.commission ?? "—"}</td>
              </tr>)}</tbody>
            </table></div>}
            {failed.length > 0 && <details className="rounded-xl border border-border p-3 text-xs"><summary className="cursor-pointer font-medium">{tn(failed.length, "{count} row will be skipped", "{count} rows will be skipped")}</summary>
              <ul className="m-0 mt-2 list-none space-y-1 p-0">{failed.slice(0, 50).map(result => <li key={result.line}>{t("Line {line}", { line: result.line })}: {result.errors.map(item => t(item)).join(", ")}</li>)}</ul>
            </details>}
            {warned.length > 0 && <details className="rounded-xl border border-border p-3 text-xs"><summary className="cursor-pointer font-medium">{tn(warned.length, "{count} row has warnings", "{count} rows have warnings")}</summary>
              <ul className="m-0 mt-2 list-none space-y-1 p-0">{warned.slice(0, 50).map(result => <li key={result.line}>{t("Line {line}", { line: result.line })}: {result.warnings.map(item => t(item)).join(", ")}</li>)}</ul>
            </details>}
            {check && <p role="status" className="m-0 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">{t("{fresh} new trades will be added; {duplicates} are already in this account and will be skipped.", { fresh: check.toImport, duplicates: check.duplicates })}</p>}
            {check && check.shifted > 0 && <p role="alert" className="m-0 rounded-xl border border-destructive/30 p-3 text-sm">{t("{count} more look like trades already in the account but with the time shifted by {hours} h — skipped. If they are the same trades, the file is probably in another time zone; pick it above and check again.", { count: check.shifted, hours: check.offsets.map(hours => (hours > 0 ? `+${hours}` : String(hours))).join(", ") })}</p>}
          </section>}
        </>}
      </div>

      <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3 sm:px-5">
        {done ? <Button size="md" onClick={close}>{t("Done")}</Button> : <>
          <Button variant="secondary" size="md" onClick={close} disabled={busy}>{t("Cancel")}</Button>
          {!check ? <Button size="md" loading={busy} disabled={!ready.length || !accountId || missing.length > 0 || noDate} onClick={() => void send(true)}>{t("Check duplicates")}</Button>
            : <Button size="md" loading={busy} disabled={check.toImport === 0} onClick={() => void send(false)}>{tn(check.toImport, "Import {count} trade into {account}", "Import {count} trades into {account}", { account: account?.name ?? "" })}</Button>}
        </>}
      </footer>
    </div>
  </div>;
}
