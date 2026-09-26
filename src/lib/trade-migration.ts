import type { TradeFinancials } from './trade-financials';

/**
 * Базовий тип угоди (спрощений, без повних полів).
 * Реальний Trade у trade-data.ts має більше полів.
 */
export interface LegacyTrade {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  status: 'OPEN' | 'CLOSED';
  result_usd?: number;
  // інші поля, які вже є
  [key: string]: unknown;
}

export interface MigratedTrade extends LegacyTrade, TradeFinancials {}

/**
 * Перевіряє, чи угода вже має фінансові поля.
 */
export function isMigratedTrade(trade: LegacyTrade | MigratedTrade): trade is MigratedTrade {
  return (
    'grossPnlUsd' in trade &&
    'commissionUsd' in trade &&
    'swapUsd' in trade &&
    'netPnlUsd' in trade
  );
}

/**
 * Мігрує одну legacy-угоду в новий формат з фінансовими полями.
 *
 * Правила:
 * - Старі manual trades (без MT5 export):
 *   netPnlUsd = result_usd
 *   commissionUsd = 0
 *   swapUsd = 0
 *   grossPnlUsd = result_usd
 *
 * - Historical MT5 trades (з commissionUsd з export):
 *   netPnlUsd = result_usd (остання сума з MT5 export)
 *   commissionUsd = з export (від'ємна)
 *   swapUsd = 0 (поки що swap не імпортується)
 *   grossPnlUsd = netPnlUsd - commissionUsd
 */
export function migrateTrade(trade: LegacyTrade | MigratedTrade): MigratedTrade {
  if (isMigratedTrade(trade)) {
    // Вже мігровано — повертаємо як є
    return trade;
  }

  const resultUsd = trade.result_usd ?? 0;

  // Поки що вважаємо всі угоди "manual".
  // MT5-логіку підключимо, коли буде явний прапорець.
  const isHistoricalMT5 = false; // TODO: додати детект за полем з MT5 export

  let commissionUsd = 0;
  let swapUsd = 0;
  let grossPnlUsd = resultUsd;
  let netPnlUsd = resultUsd;

  if (isHistoricalMT5) {
    // Логіка для MT5 historical trades буде тут,
    // коли з'явиться явний прапорець або поле з export.
  }

  return {
    ...trade,
    grossPnlUsd,
    commissionUsd,
    swapUsd,
    netPnlUsd,
  } as MigratedTrade;
}

/**
 * Мігрує весь список угод з localStorage.
 */
export function migrateTrades(trades: (LegacyTrade | MigratedTrade)[]): MigratedTrade[] {
  return trades.map(migrateTrade);
}
