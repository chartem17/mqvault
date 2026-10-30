'use client';

import { useEffect, useState, useCallback } from 'react';
import { type UserStorage, getOrCreateUserStorage, saveUserStorage } from '../lib/user-storage';
import type { TradingData } from '../lib/user-storage';
import type { Trade } from '../lib/trade-types';

const DEFAULT_USER_ID = 'local-user-1';

export function useUserStorage() {
  const [storage, setStorage] = useState<UserStorage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userId] = useState<string>(DEFAULT_USER_ID);
  useEffect(() => {
    const data = getOrCreateUserStorage(userId);
    setStorage(data);
    setIsLoading(false);
  }, [userId]);
  const updateStorage = useCallback((updater: (prev: UserStorage) => UserStorage) => {
    setStorage((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      saveUserStorage(userId, next);
      return next;
    });
  }, [userId]);
  const updateTradingData = useCallback((updater: (prev: TradingData) => TradingData) => {
    updateStorage((prev) => ({ ...prev, tradingData: updater(prev.tradingData) }));
  }, [updateStorage]);
  const addTrade = useCallback((trade: Trade) => {
    updateTradingData((prev) => ({ ...prev, trades: [...prev.trades, trade] }));
  }, [updateTradingData]);
  const updateTrade = useCallback((tradeId: string, updater: (t: Trade) => Trade) => {
    updateTradingData((prev) => ({ ...prev, trades: prev.trades.map((t) => (t.id === tradeId ? updater(t) : t)) }));
  }, [updateTradingData]);
  const deleteTrade = useCallback((tradeId: string) => {
    updateTradingData((prev) => ({ ...prev, trades: prev.trades.filter((t) => t.id !== tradeId) }));
  }, [updateTradingData]);
  const trades = storage?.tradingData.trades ?? [];
  return { storage, isLoading, userId, trades, addTrade, updateTrade, deleteTrade, updateStorage, updateTradingData };
}

export function getUserStorageSync(userId: string = DEFAULT_USER_ID): UserStorage {
  return getOrCreateUserStorage(userId);
}
