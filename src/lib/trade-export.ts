import type { Trade } from './trade-types';

/**
 * Експортує масив угод у CSV-формат.
 * Кожна угода — один рядок із чітко визначеними колонками.
 *
 * Колонки:
 * id, symbol, type, status, source, entryPrice, closePrice, volume,
 * grossPnlUsd, commissionUsd, swapUsd, netPnlUsd, result_usd,
 * openTime, closeTime, mt5TicketId, mt5Magic, mt5Comment, mt5ImportId,
 * strategyId, notes, tags
 */
export function exportTradesToCSV(trades: Trade[]): string {
  const headers = [
    'id',
    'symbol',
    'type',
    'status',
    'source',
    'entryPrice',
    'closePrice',
    'volume',
    'grossPnlUsd',
    'commissionUsd',
    'swapUsd',
    'netPnlUsd',
    'result_usd',
    'openTime',
    'closeTime',
    'mt5TicketId',
    'mt5Magic',
    'mt5Comment',
    'mt5ImportId',
    'strategyId',
    'notes',
    'tags',
  ];

  const rows = trades.map((t) => {
    const row = [
      escapeCSV(t.id ?? ''),
      escapeCSV(t.symbol ?? ''),
      escapeCSV(t.type ?? ''),
      escapeCSV(t.status ?? ''),
      escapeCSV(t.source ?? ''),
      formatNumber(t.entryPrice),
      formatNumber(t.closePrice),
      formatNumber(t.volume),
      formatNumber(t.grossPnlUsd),
      formatNumber(t.commissionUsd),
      formatNumber(t.swapUsd),
      formatNumber(t.netPnlUsd),
      formatNumber(t.result_usd),
      formatTimestamp(t.openTime),
      formatTimestamp(t.closeTime),
      escapeCSV(t.mt5TicketId ?? ''),
      formatNumber(t.mt5Magic),
      escapeCSV(t.mt5Comment ?? ''),
      escapeCSV(t.mt5ImportId ?? ''),
      escapeCSV(t.strategyId ?? ''),
      escapeCSV(t.notes ?? ''),
      escapeCSV(t.tags ? t.tags.join(';') : ''),
    ];
    return row.join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Екранує рядок для CSV (якщо є коми, лапки, нові рядки).
 */
function escapeCSV(value: string): string {
  if (!value) return '';
  const needsQuotes = /[",\n\r]/.test(value);
  if (!needsQuotes) return value;
  return '"' + value.replace(/"/g, '""') + '"';
}

function formatNumber(value: number | undefined): string {
  if (value == null) return '';
  return String(value);
}

function formatTimestamp(ts: number | undefined): string {
  if (!ts) return '';
  return new Date(ts).toISOString();
}

/**
 * Створює CSV-файл для завантаження в браузері.
 * Викликається з кнопки в UI.
 */
export function downloadTradesCSV(trades: Trade[], filename = 'mqvault-journal.csv'): void {
  const csv = exportTradesToCSV(trades);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
