'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  type UserStorage,
  getOrCreateUserStorage,
  saveUserStorage,
  loadUserStorage,
} from '../lib/user-storage';
import type { TradingData } from '../lib/user-storage';
import type { Trade } from '../lib/trade-types';

/**
 * Хардкодний userId для локальної розробки.
 * У майбутньому — з авторизації / контексту.
 */
const DEFAULT_USER_ID = 'local-user-1';

/**
 * Хук для доступу до UserStorage.
 * Забезпечує швидкий доступ до даних через localStorage.
 *
 * - Завантажує дані один раз при першому рендері.
 * - Зберігає в стані для миттєвого доступу.
 * - Надає функції для оновлення.
 */
export function useUserStorage() {
  const [storage, setStorage] = useState<UserStorage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userId] = useState<string>(DEFAULT_USER_ID);

  // Ініціалізація при першому рендері
  useEffect(() => {
    // Синхронне читання з localStorage — дуже швидко
    const data = getOrCreateUserStorage(userId);
    setStorage(data);
    setIsLoading(false);
  }, [userId]);

  // Оновлення всього сховища
  const updateStorage = useCallback((updater: (prev: UserStorage) => UserStorage) => {
    setStorage((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      saveUserStorage(userId, next);
      return next;
    });
  }, [userId]);

  // Оновлення торгових даних
  const updateTradingData = useCallback((updater: (prev: TradingData) => TradingData) => {
    updateStorage((prev) => ({
      ...prev,
      tradingData: updater(prev.tradingData),
    }));
  }, [updateStorage]);

  // Додавання угоди
  const addTrade = useCallback((trade: Trade) => {
    updateTradingData((prev) => ({
      ...prev,
      trades: [...prev.trades, trade],
    }));
  }, [updateTradingData]);

  // Оновлення угоди
  const updateTrade = useCallback((tradeId: string, updater: (t: Trade) => Trade) => {
    updateTradingData((prev) => ({
      ...prev,
      trades: prev.trades.map((t) => (t.id === tradeId ? updater(t) : t)),
    }));
  }, [updateTradingData]);

  // Видалення угоди
  const deleteTrade = useCallback((tradeId: string) => {
    updateTradingData((prev) => ({
      ...prev,
      trades: prev.trades.filter((t) => t.id !== tradeId),
    }));
  }, [updateTradingData]);

  // Отримання всіх угод
  const trades = storage?.tradingData.trades ?? [];

  return {
    storage,
    isLoading,
    userId,
    trades,
    addTrade,
    updateTrade,
    deleteTrade,
    updateStorage,
    updateTradingData,
  };
}

/**
 * Синхронна версія для використання поза React-компонентами.
 * Використовувати обережно — тільки коли впевнені, що localStorage вже ініціалізовано.
 */
export function getUserStorageSync(userId: string = DEFAULT_USER_ID): UserStorage {
  return getOrCreateUserStorage(userId);
}
