import type { AccountTrade } from '@/hooks/use-trades';
import type { TradingAccount } from '@/lib/account-data';

/**
 * Експортує реальні угоди (AccountTrade) у CSV, як вони відображаються в Journal.
 * Не вигадує нових полів — тільки те, які вже є в реальній структурі Trade.
 */
export function exportJournalToCSV(
  trades: AccountTrade[],
  accounts: TradingAccount[]
): string {
  const accountName = (id: string) =>
    accounts.find((a) => a.id === id)?.name ?? id;

  const headers = [
    'Date',
    'Time',
    'Account',
    'Pair',
    'Market',
    'Direction',
    'Entry',
    'Stop',
    'TP',
    'Exit',
    'Risk %',
    'P&L USD',
    'R',
    'Session',
    'Setup',
    'HTF Bias',
    'Entry Reason',
    'Exit Reason',
    'Emotion',
    'Mistake',
    'Notes',
    'Source',
  ];

  const escape = (v: unknown): string => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };

  const rows = trades.map((t) =>
    [
      t.date,
      t.time,
      accountName(t.accountId),
      t.pair,
      t.market,
      t.direction,
      t.entry,
      t.stop,
      t.tp,
      t.exitprice,
      t.riskpct,
      t.resultusd,
      t.resultr,
      t.session,
      t.setup,
      t.htfbias,
      t.entryreason,
      t.exitreason,
      t.emotion,
      t.mistake,
      t.notes,
      t.source ?? 'manual',
    ]
      .map(escape)
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Завантажує CSV-файл журналу в браузері.
 */
export function downloadJournalCSV(
  trades: AccountTrade[],
  accounts: TradingAccount[],
  filename = 'mqvault-journal.csv'
): void {
  const csv = exportJournalToCSV(trades, accounts);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
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
