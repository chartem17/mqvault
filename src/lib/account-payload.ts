import { parseAccountSetup, AccountSetupError } from "./account-setup";
export type AccountRecord = Record<string, unknown>;
const own = (value: AccountRecord, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const pairs = [["accountType", "account_type"], ["initialBalance", "initial_balance"], ["targetPercent", "target_percent"], ["maxLossPercent", "max_loss_percent"], ["dailyLossPercent", "daily_loss_percent"], ["minTradingDays", "min_trading_days"]] as const;
function read(body: AccountRecord, camel: string, snake = camel): unknown {
  if (camel !== snake && own(body, camel) && own(body, snake) && body[camel] !== body[snake]) throw new AccountSetupError(`Conflicting ${camel}`);
  return own(body, camel) ? body[camel] : body[snake];
}
function text(value: unknown, field: string, nullable = true): string | null {
  if (value === null && nullable) return null;
  if (typeof value !== "string" || value.length > 200) throw new AccountSetupError(`Invalid ${field}`);
  const result = value.trim();
  if (!nullable && !result) throw new AccountSetupError(`${field} is required`);
  return result || null;
}
function storedNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  throw new AccountSetupError("Invalid stored account number");
}
export function buildAccountPayload(body: AccountRecord, current?: AccountRecord): AccountRecord {
  const payload: AccountRecord = {};
  if (!current || own(body, "name")) payload.name = text(body.name, "name", false);
  for (const [camel, snake] of [["broker", "broker"], ["mt5Login", "mt5_login"], ["mt5Server", "mt5_server"], ["color", "color"], ["parentAccountId", "parent_account_id"]]) {
    if (own(body, camel) || own(body, snake)) payload[snake] = text(read(body, camel, snake), camel);
  }
  if (payload.color !== undefined && payload.color !== null && !/^#[0-9a-f]{6}$/i.test(String(payload.color))) throw new AccountSetupError("Invalid color");
  if (payload.parent_account_id !== undefined && payload.parent_account_id !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(payload.parent_account_id))) throw new AccountSetupError("Invalid parent account");
  if (!current || own(body, "currency")) {
    const currency = body.currency ?? "USD";
    if (currency !== "USD" && currency !== "USDT") throw new AccountSetupError("Invalid currency");
    payload.currency = currency;
  }
  if (!current || own(body, "status")) {
    const status = body.status ?? "active";
    if (!["active", "passed", "failed"].includes(String(status)) || typeof status !== "string") throw new AccountSetupError("Invalid account status");
    payload.status = status;
  }
  const setupTouched = !current || own(body, "platform") || own(body, "phase") || pairs.some(([camel, snake]) => own(body, camel) || own(body, snake));
  if (setupTouched) {
    const accountType = own(body, "accountType") || own(body, "account_type") ? read(body, "accountType", "account_type") : current?.account_type;
    const platform = own(body, "platform") ? body.platform : current?.platform;
    const merged: AccountRecord = { accountType, platform, initialBalance: own(body, "initialBalance") || own(body, "initial_balance") ? read(body, "initialBalance", "initial_balance") : storedNumber(current?.initial_balance) };
    const previousProp = current?.account_type === "prop" && accountType === "prop";
    merged.phase = own(body, "phase") ? body.phase : previousProp ? current?.phase ?? null : null;
    for (const [camel, snake] of pairs.slice(2)) merged[camel] = own(body, camel) || own(body, snake) ? read(body, camel, snake) : previousProp ? storedNumber(current?.[snake]) : null;
    const setup = parseAccountSetup(merged);
    if (setup.minTradingDays !== null && setup.minTradingDays > 2147483647) throw new AccountSetupError("Minimum trading days exceeds database integer range");
    const values: AccountRecord = { account_type: setup.accountType, platform: setup.platform, initial_balance: setup.initialBalance, phase: setup.phase, target_percent: setup.targetPercent, max_loss_percent: setup.maxLossPercent, daily_loss_percent: setup.dailyLossPercent, min_trading_days: setup.minTradingDays };
    const changedType = current && setup.accountType !== current.account_type;
    for (const [camel, snake] of [...pairs, ["platform", "platform"], ["phase", "phase"]]) {
      if (!current || changedType || own(body, camel) || own(body, snake)) payload[snake] = values[snake];
    }
    const login = payload.mt5_login === undefined ? current?.mt5_login : payload.mt5_login;
    if (setup.platform === "mt5" && (typeof login !== "string" || !login.trim())) throw new AccountSetupError("MT5 login is required");
  }
  return payload;
}
