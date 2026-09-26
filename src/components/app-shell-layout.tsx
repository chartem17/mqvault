'use client';

import React from 'react';
import { useUserStorage } from '@/hooks/useUserStorage';
import { downloadTradesCSV } from '@/lib/trade-export';
import {
  downloadUserStorageBackup,
  uploadAndImportUserStorageBackup,
} from '@/lib/user-storage-backup';

/**
 * AppShellLayout з доданими кнопками експорту/імпорту.
 */
export function AppShellLayout({ children }: { children: React.ReactNode }) {
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold">MQVault</h1>

          {/* Кнопки експорту/імпорту */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
              title="Експортувати журнал угод у CSV"
            >
              📥 CSV
            </button>

            <button
              onClick={handleBackupJSON}
              className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
              title="Зберегти повну резервну копію"
            >
              💾 JSON
            </button>

            <button
              onClick={handleImportJSON}
              className="px-3 py-1.5 bg-orange-600 text-white rounded hover:bg-orange-700 text-xs"
              title="Імпортувати резервну копію"
            >
              📤 Імпорт
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-6">{children}</main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-3 text-center text-sm text-muted-foreground">
          MQVault — Trading Journal & Analytics
        </div>
      </footer>
    </div>
  );
}
