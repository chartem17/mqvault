import type { Trade } from './trade-types';
import type { MT5ImportRecord } from './mt5-imports';

/**
 * Ключі localStorage для нового формату.
 * Формат: mqvault-user-{userId}-*
 */
const USER_STORAGE_KEYS = {
  PROFILE: (userId: string) => `mqvault-user-${userId}-profile`,
  TRADING: (userId: string) => `mqvault-user-${userId}-trading`,
} as const;

/**
 * Старі ключі localStorage (legacy).
 */
const LEGACY_KEYS = {
  TRADES: 'mqvault-trades',
  SETTINGS: 'mqvault-settings',
  STRATEGIES: 'mqvault-strategies',
} as const;

// ==================== Профіль користувача ====================

export type Currency = 'USD' | 'EUR' | 'GBP' | 'UAH';

export interface UserSettings {
  timezone?: string;
  currency: Currency;
  language?: 'uk' | 'en' | 'ru';
  // інші налаштування (теми, сповіщення тощо)
}

export interface StrategyConfig {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  // параметри стратегії (ризик, інструменти, правила тощо)
  params?: Record<string, unknown>;
}

export interface UserProfile {
  userId: string;
  createdAt: number;
  updatedAt: number;

  displayName?: string;
  email?: string;

  settings: UserSettings;
  strategies: StrategyConfig[];
}

// ==================== Торгові дані ====================

export interface TradingData {
  userId: string;

  trades: Trade[];
  mt5Imports: MT5ImportRecord[];

  // Кешована статистика (опціонально)
  stats?: {
    totalPnlUsd: number;
    winRate: number;
    totalTrades: number;
    updatedAt: number;
  };

  updatedAt: number;
}

// ==================== Об'єднане сховище ====================

export interface UserStorage {
  profile: UserProfile;
  tradingData: TradingData;
}

// ==================== Допоміжні функції ====================

function now(): number {
  return Date.now();
}

function safeParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

// ==================== Ініціалізація ====================

export function createDefaultUserProfile(userId: string): UserProfile {
  const nowTs = now();
  return {
    userId,
    createdAt: nowTs,
    updatedAt: nowTs,
    settings: {
      currency: 'USD',
      language: 'uk',
    },
    strategies: [],
  };
}

export function createDefaultTradingData(userId: string): TradingData {
  const nowTs = now();
  return {
    userId,
    trades: [],
    mt5Imports: [],
    updatedAt: nowTs,
  };
}

export function initUserStorage(userId: string): UserStorage {
  const profile = createDefaultUserProfile(userId);
  const tradingData = createDefaultTradingData(userId);

  localStorage.setItem(USER_STORAGE_KEYS.PROFILE(userId), JSON.stringify(profile));
  localStorage.setItem(USER_STORAGE_KEYS.TRADING(userId), JSON.stringify(tradingData));

  return { profile, tradingData };
}

// ==================== Завантаження / Збереження ====================

export function loadUserProfile(userId: string): UserProfile | null {
  const json = localStorage.getItem(USER_STORAGE_KEYS.PROFILE(userId));
  return safeParse<UserProfile | null>(json, null);
}

export function loadTradingData(userId: string): TradingData | null {
  const json = localStorage.getItem(USER_STORAGE_KEYS.TRADING(userId));
  return safeParse<TradingData | null>(json, null);
}

export function loadUserStorage(userId: string): UserStorage | null {
  const profile = loadUserProfile(userId);
  const tradingData = loadTradingData(userId);

  if (!profile || !tradingData) {
    return null;
  }

  return { profile, tradingData };
}

export function saveUserProfile(userId: string, profile: UserProfile): void {
  const updated: UserProfile = { ...profile, updatedAt: now() };
  localStorage.setItem(USER_STORAGE_KEYS.PROFILE(userId), JSON.stringify(updated));
}

export function saveTradingData(userId: string, tradingData: TradingData): void {
  const updated: TradingData = { ...tradingData, updatedAt: now() };
  localStorage.setItem(USER_STORAGE_KEYS.TRADING(userId), JSON.stringify(updated));
}

export function saveUserStorage(userId: string, storage: UserStorage): void {
  saveUserProfile(userId, storage.profile);
  saveTradingData(userId, storage.tradingData);
}

// ==================== Міграція з legacy ====================

/**
 * Перевіряє, чи є старі дані в localStorage.
 */
export function hasLegacyData(): boolean {
  const trades = localStorage.getItem(LEGACY_KEYS.TRADES);
  const settings = localStorage.getItem(LEGACY_KEYS.SETTINGS);
  const strategies = localStorage.getItem(LEGACY_KEYS.STRATEGIES);

  return !!(trades || settings || strategies);
}

/**
 * Мігрує старі дані з localStorage в нову структуру UserStorage.
 * Повертає нове UserStorage або null, якщо міграція неможлива.
 */
export function migrateLegacyData(userId: string): UserStorage | null {
  if (!hasLegacyData()) {
    return null;
  }

  // Завантажуємо legacy-дані
  const legacyTradesJson = localStorage.getItem(LEGACY_KEYS.TRADES);
  const legacySettingsJson = localStorage.getItem(LEGACY_KEYS.SETTINGS);
  const legacyStrategiesJson = localStorage.getItem(LEGACY_KEYS.STRATEGIES);

  const legacyTrades: Trade[] = safeParse<Trade[]>(legacyTradesJson, []);
  const legacySettings: Partial<UserSettings> = safeParse<Partial<UserSettings>>(legacySettingsJson, {});
  const legacyStrategies: StrategyConfig[] = safeParse<StrategyConfig[]>(legacyStrategiesJson, []);

  // Створюємо новий профіль
  const profile: UserProfile = {
    ...createDefaultUserProfile(userId),
    settings: {
      currency: legacySettings.currency ?? 'USD',
      language: legacySettings.language ?? 'uk',
      timezone: legacySettings.timezone,
    },
    strategies: legacyStrategies.length > 0 ? legacyStrategies : [],
  };

  // Створюємо торгові дані
  const tradingData: TradingData = {
    ...createDefaultTradingData(userId),
    trades: legacyTrades,
    mt5Imports: [], // MT5-імпортів ще немає
  };

  const storage: UserStorage = { profile, tradingData };
  saveUserStorage(userId, storage);

  // Опціонально: можна видалити legacy-ключі
  // localStorage.removeItem(LEGACY_KEYS.TRADES);
  // localStorage.removeItem(LEGACY_KEYS.SETTINGS);
  // localStorage.removeItem(LEGACY_KEYS.STRATEGIES);

  return storage;
}

/**
 * Головна функція ініціалізації:
 * - якщо є UserStorage → завантажує;
 * - якщо є legacy → мігрує;
 * - якщо нічого немає → створює нове.
 */
export function getOrCreateUserStorage(userId: string): UserStorage {
  const existing = loadUserStorage(userId);
  if (existing) {
    return existing;
  }

  const migrated = migrateLegacyData(userId);
  if (migrated) {
    return migrated;
  }

  return initUserStorage(userId);
}
