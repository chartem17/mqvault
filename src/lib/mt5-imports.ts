import type { Trade } from './trade-types';

/**
 * Джерело імпорту.
 */
export type MT5ImportSource = 'MT5_CSV' | 'MT5_HTML';

/**
 * Сирий рядок імпорту (CSV/HTML) у вигляді об'єкта.
 * Ключі — назви колонок, значення — рядки.
 */
export type RawMT5Row = Record<string, string>;

/**
 * Запис про імпорт з MT5.
 * Зберігає як сирі дані, так і сконвертовані угоди.
 */
export interface MT5ImportRecord {
  importId: string; // UUID або timestamp
  importedAt: number; // timestamp
  source: MT5ImportSource;

  // Сирий вміст (для аудиту, реімпорту, дебагу)
  rawFileName?: string;
  rawRows: RawMT5Row[];

  // Вже сконвертовані угоди, які пішли в журнал
  trades: Trade[];

  // Мета-інформація (опціонально)
  notes?: string;
}

/**
 * Ключ localStorage для MT5-імпортів.
 * Формат: mqvault-user-{userId}-mt5-imports
 */
const MT5_IMPORTS_KEY = (userId: string) => `mqvault-user-${userId}-mt5-imports`;

function safeParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Завантажує всі MT5-іморти для користувача.
 */
export function loadMT5Imports(userId: string): MT5ImportRecord[] {
  const json = localStorage.getItem(MT5_IMPORTS_KEY(userId));
  return safeParse<MT5ImportRecord[]>(json, []);
}

/**
 * Зберігає всі MT5-іморти для користувача.
 */
export function saveMT5Imports(userId: string, imports: MT5ImportRecord[]): void {
  localStorage.setItem(MT5_IMPORTS_KEY(userId), JSON.stringify(imports));
}

/**
 * Додає новий MT5-імпорт до списку.
 */
export function addMT5Import(userId: string, record: MT5ImportRecord): void {
  const imports = loadMT5Imports(userId);
  imports.push(record);
  saveMT5Imports(userId, imports);
}

/**
 * Отримує конкретний імпорт за importId.
 */
export function getMT5ImportById(
  userId: string,
  importId: string
): MT5ImportRecord | undefined {
  const imports = loadMT5Imports(userId);
  return imports.find((imp) => imp.importId === importId);
}

/**
 * Отримує імпорт, до якого належить угода (за mt5ImportId).
 */
export function getMT5ImportByTradeId(
  userId: string,
  tradeId: string
): MT5ImportRecord | undefined {
  const imports = loadMT5Imports(userId);
  return imports.find((imp) => imp.trades.some((t) => t.id === tradeId));
}

/**
 * Створює новий запис імпорту з сирих даних і сконвертованих угод.
 */
export function createMT5ImportRecord(params: {
  importId: string;
  source: MT5ImportSource;
  rawFileName?: string;
  rawRows: RawMT5Row[];
  trades: Trade[];
  notes?: string;
}): MT5ImportRecord {
  return {
    importId: params.importId,
    importedAt: Date.now(),
    source: params.source,
    rawFileName: params.rawFileName,
    rawRows: params.rawRows,
    trades: params.trades,
    notes: params.notes,
  };
}

/**
 * Експортує всі іморти в CSV (для бекапу або дебагу).
 * Повертає CSV-рядок.
 */
export function exportMT5ImportsToCSV(imports: MT5ImportRecord[]): string {
  const headers = [
    'importId',
    'importedAt',
    'source',
    'rawFileName',
    'tradeId',
    'symbol',
    'type',
    'status',
    'entryPrice',
    'closePrice',
    'volume',
    'result_usd',
    'mt5TicketId',
    'mt5Magic',
    'mt5Comment',
  ];

  const rows: string[] = [];

  for (const imp of imports) {
    for (const trade of imp.trades) {
      const row = [
        imp.importId,
        new Date(imp.importedAt).toISOString(),
        imp.source,
        imp.rawFileName ?? '',
        trade.id ?? '',
        trade.symbol ?? '',
        trade.type ?? '',
        trade.status ?? '',
        String(trade.entryPrice ?? ''),
        String(trade.closePrice ?? ''),
        String(trade.volume ?? ''),
        String(trade.result_usd ?? ''),
        String(trade.mt5TicketId ?? ''),
        String(trade.mt5Magic ?? ''),
        String(trade.mt5Comment ?? ''),
      ];
      rows.push(row.join(','));
    }
  }

  return [headers.join(','), ...rows].join('\n');
}
