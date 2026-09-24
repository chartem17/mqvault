'use client';

import { useCallback } from 'react';
import { useUserStorage } from './useUserStorage';
import type { Trade, TradeInput } from '../lib/trade-types';
import { migrateTrades } from '../lib/trade-migration';

/**
 * Хук для роботи з угодами через нову систему UserStorage.
 * Забезпечує швидкий доступ до даних без затримок.
 */
export function useTrades() {
  const {
    storage,
    isLoading,
    userId,
    trades,
    addTrade,
    updateTrade,
    deleteTrade,
    updateTradingData,
  } = useUserStorage();

  // Міграція угод при першому завантаженні (якщо потрібно)
  const migratedTrades = isLoading || !storage ? trades : migrateTrades(trades);

  // Створення нової угоди
  const createTrade = useCallback((input: TradeInput): Trade => {
    const newTrade: Trade = {
      id: crypto.randomUUID(),
      symbol: input.symbol ?? '',
      type: input.type ?? 'BUY',
      status: input.status ?? 'CLOSED',
      source: input.source ?? 'MANUAL',
      entryPrice: input.entryPrice,
      closePrice: input.closePrice,
      volume: input.volume,
      result_usd: input.result_usd,
      openTime: input.openTime,
      closeTime: input.closeTime,
      notes: input.notes,
      tags: input.tags,
      strategyId: input.strategyId,
      // Фінансові поля будуть обчислені окремо
      grossPnlUsd: input.result_usd,
      commissionUsd: 0,
      swapUsd: 0,
      netPnlUsd: input.result_usd,
    };

    addTrade(newTrade);
    return newTrade;
  }, [addTrade]);

  // Оновлення угоди
  const patchTrade = useCallback((tradeId: string, updates: Partial<Trade>) => {
    updateTrade(tradeId, (prev) => ({ ...prev, ...updates }));
  }, [updateTrade]);

  // Видалення угоди
  const removeTrade = useCallback((tradeId: string) => {
    deleteTrade(tradeId);
  }, [deleteTrade]);

  // Імпорт MT5 (буде реалізовано окремо)
  const importMT5Trades = useCallback(async (params: {
    source: 'MT5_CSV' | 'MT5_HTML';
    rawRows: Record<string, string>[];
    trades: Trade[];
  }) => {
    // 1. Створити MT5ImportRecord
    // 2. Додати його в mt5Imports
    // 3. Додати угоди в trades
    // Реалізація буде в окремому файлі для імпорту
    console.log('MT5 import not yet implemented', params);
  }, [updateTradingData]);

  return {
    isLoading,
    userId,
    trades: migratedTrades,
    createTrade,
    patchTrade,
    removeTrade,
    importMT5Trades,
  };
}
