/** CSV of the user's trades for the data export (Settings → Your data). Pure; RFC 4180 quoting, formula-safe. */
export const CSV_COLUMNS = [
  "id", "account", "symbol", "direction", "opened_at", "closed_at", "entry_price", "exit_price", "stop_loss", "take_profit",
  "volume", "gross_pnl", "commission", "swap", "fee", "net_pnl", "result_r", "session", "setup", "emotion", "mistake", "notes", "screenshot_url",
] as const;

/** Quotes a cell; a leading = + - @ (or tab/CR) is prefixed so spreadsheets never run it as a formula. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function tradesCsv(rows: readonly Record<string, unknown>[], accountNames: ReadonlyMap<string, string>): string {
  const lines = [CSV_COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(CSV_COLUMNS.map(column => csvCell(column === "account" ? accountNames.get(String(row.account_id)) ?? row.account_id : row[column])).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
