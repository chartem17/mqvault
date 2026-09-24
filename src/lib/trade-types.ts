import type { TradeFinancials } from './trade-financials';

export type TradeType = 'BUY' | 'SELL';
export type TradeStatus = 'OPEN' | 'CLOSED';
export type TradeSource = 'MANUAL' | 'MT5_EXPORT';

/**
 * Основний тип угоди з фінансовими полями.
 * Поля grossPnlUsd, commissionUsd, swapUsd, netPnlUsd використовуються
 * для правильного розрахунку P&L з урахуванням комісій.
 */
export interface Trade extends TradeFinancials {
  id: string;
  symbol: string;
  type: TradeType;
  status: TradeStatus;
  source?: TradeSource;

  // Ціни та об'єм
  entryPrice?: number;
  closePrice?: number;
  volume?: number; // у лотах

  // Результат у валюті депозиту (USD)
  result_usd?: number;

  // Дати
  openTime?: number; // timestamp ms
  closeTime?: number; // timestamp ms

  // Додаткові поля, які вже можуть бути
  notes?: string;
  tags?: string[];
  strategyId?: string;

  // Поля для MT5 export (можуть бути відсутні для manual)
  mt5TicketId?: string;
  mt5Magic?: number;
  mt5Comment?: string;

  // Розширення для майбутніх полів
  [key: string]: unknown;
}

/**
 * Тип для форми створення/редагування угоди.
 * Всі поля, крім id, можуть бути відсутні.
 */
export type TradeInput = Omit<Partial<Trade>, 'id'>;

/**
 * Фільтри для списку угод.
 */
export interface TradeFilters {
  symbol?: string;
  status?: TradeStatus;
  type?: TradeType;
  source?: TradeSource;
  strategyId?: string;
  tag?: string;
  dateFrom?: number;
  dateTo?: number;
}
