'use client';

import { useUserStorage } from '@/hooks/useUserStorage';
import { downloadTradesCSV } from '@/lib/trade-export';
import {
  downloadUserStorageBackup,
  uploadAndImportUserStorageBackup,
} from '@/lib/user-storage-backup';

/**
 * Компонент з кнопками для експорту/імпорту даних.
 * Можна додати в будь-яке місце (Overview, Settings, тощо).
 */
export function DataBackupButtons() {
  const { userId, trades } = useUserStorage();

  const handleExportCSV = () => {
    if (trades.length === 0) {
      alert('Немає угод для експорту');
      return;
    }
    downloadTradesCSV(trades, 'mqvault-journal.csv');
  };

  const handleBackupJSON = () => {
    downloadUserStorageBackup(userId);
  };

  const handleImportJSON = () => {
    uploadAndImportUserStorageBackup(userId, (result) => {
      if (result.success) {
        alert('Резервну копію успішно імпортовано!\nСторінка буде перезавантажена.');
        window.location.reload();
      } else {
        alert(`Помилка імпорту: ${result.error}`);
      }
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={handleExportCSV}
        className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
      >
        📥 Експорт журналу (CSV)
      </button>

      <button
        onClick={handleBackupJSON}
        className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
      >
        💾 Резервна копія (JSON)
      </button>

      <button
        onClick={handleImportJSON}
        className="px-3 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 text-sm"
      >
        📤 Імпорт резервної копії
      </button>
    </div>
  );
}
