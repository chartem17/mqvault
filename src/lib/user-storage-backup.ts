import type { UserStorage } from './user-storage';
import { loadUserStorage, saveUserStorage } from './user-storage';

/**
 * Експортує все UserStorage користувача в JSON-рядок.
 * Це повна резервна копія всіх даних юзера.
 */
export function exportUserStorageToJSON(userId: string): string | null {
  const storage = loadUserStorage(userId);
  if (!storage) {
    return null;
  }

  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    userId,
    storage,
  };

  return JSON.stringify(backup, null, 2);
}

/**
 * Завантажує JSON-файл з резервною копією в браузері.
 * Файл буде називатися mqvault-backup-{userId}-{date}.json
 */
export function downloadUserStorageBackup(userId: string): void {
  const json = exportUserStorageToJSON(userId);
  if (!json) {
    console.error('UserStorage is empty or not found');
    return;
  }

  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const filename = `mqvault-backup-${userId}-${date}.json`;

  const blob = new Blob([json], { type: 'application/json' });
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

/**
 * Імпортує UserStorage з JSON-рядка.
 * Перевіряє версію, userId та цілісність даних.
 * Повертає помилку, якщо імпорт не вдався.
 */
export function importUserStorageFromJSON(
  userId: string,
  jsonString: string
): { success: true } | { success: false; error: string } {
  try {
    const parsed = JSON.parse(jsonString) as {
      version?: number;
      exportedAt?: string;
      userId?: string;
      storage?: UserStorage;
    };

    // Перевірка версії
    if (parsed.version !== 1) {
      return {
        success: false,
        error: `Unsupported backup version: ${parsed.version}. Expected version 1.`,
      };
    }

    // Перевірка userId
    if (parsed.userId !== userId) {
      return {
        success: false,
        error: `User ID mismatch. Backup userId: ${parsed.userId}, current userId: ${userId}.`,
      };
    }

    // Перевірка наявності storage
    if (!parsed.storage || !parsed.storage.profile || !parsed.storage.tradingData) {
      return {
        success: false,
        error: 'Invalid backup structure: missing storage, profile, or tradingData.',
      };
    }

    // Збереження імпортованих даних
    saveUserStorage(userId, parsed.storage);

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: `Failed to parse backup JSON: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Відкриває діалог вибору файлу для імпорту резервної копії.
 * Після вибору файлу автоматично імпортує дані.
 */
export function uploadAndImportUserStorageBackup(
  userId: string,
  onResult: (result: { success: true } | { success: false; error: string }) => void
): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';

  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) {
      onResult({ success: false, error: 'No file selected' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const result = importUserStorageFromJSON(userId, text);
      onResult(result);
    };
    reader.onerror = () => {
      onResult({ success: false, error: 'Failed to read file' });
    };
    reader.readAsText(file);
  };

  input.click();
}
