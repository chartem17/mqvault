import type { TradeFinancials } from './trade-financials';

export type TradeType = 'BUY' | 'SELL';
export type TradeStatus = 'OPEN' | 'CLOSED';
export type TradeSource = 'MANUAL' | 'MT5_EXPORT';

/**
 * Основний тип угоди з фінансовими полями та MT5-метаданими.
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

  // Додаткові поля
  notes?: string;
  tags?: string[];
  strategyId?: string;

  // MT5-метадані (для імпортованих угод)
  mt5TicketId?: string;
  mt5Magic?: number;
  mt5Comment?: string;
  mt5ImportId?: string; // посилання на MT5ImportRecord

  // Розширення для майбутніх полів
  [key: string]: unknown;
}

/**
 * Тип для форми створення/редагування угоди.
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
