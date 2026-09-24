# Trade Financial Model & User Storage Structure

Ця гілка (`feature/trade-financial-model`) містить повну переробку структури даних для:
- Чіткого розділення даних по користувачах (`userId`).
- Фінансової моделі угод (Gross/Commission/Swap/Net).
- Збереження сирих MT5-імпортів.
- Експорту/імпорту резервних копій.

## Створені файли

### Бібліотека (`src/lib/`)

1. **`trade-financials.ts`**
   - Тип `TradeFinancials` (grossPnlUsd, commissionUsd, swapUsd, netPnlUsd).
   - Функції для розрахунку фінансових показників.

2. **`trade-migration.ts`**
   - Функції `migrateTrade()`, `migrateTrades()` для міграції старих угод у новий формат.

3. **`trade-types.ts`**
   - Тип `Trade` з фінансовими полями та MT5-метаданими (source, mt5TicketId, mt5Magic, mt5Comment, mt5ImportId).

4. **`user-storage.ts`**
   - Типи `UserProfile`, `TradingData`, `UserStorage`.
   - Функції `loadUserStorage()`, `saveUserStorage()`, `migrateLegacyData()`, `getOrCreateUserStorage()`.

5. **`mt5-imports.ts`**
   - Тип `MT5ImportRecord` (сирі дані + сконвертовані угоди).
   - Функції `loadMT5Imports()`, `saveMT5Imports()`, `addMT5Import()`, `getMT5ImportById()`.

6. **`trade-export.ts`**
   - Функції `exportTradesToCSV()`, `downloadTradesCSV()` для експорту журналу в CSV.

7. **`user-storage-backup.ts`**
   - Функції `exportUserStorageToJSON()`, `downloadUserStorageBackup()`, `importUserStorageFromJSON()` для резервних копій.

### Хуки (`src/hooks/`)

8. **`useUserStorage.ts`**
   - Хук для швидкого доступу до `UserStorage` через localStorage.
   - Забезпечує ліниву ініціалізацію, мінімум затримок.

9. **`use-trades.ts`**
   - Нова версія хука для роботи з угодами.
   - Використовує `useUserStorage` всередині.

## Архітектура

### Стара структура (legacy)

```
localStorage:
  mqvault-trades       → [усі угоди]
  mqvault-settings     → { ... }
  mqvault-strategies   → [ ... ]
```

Проблеми:
- Немає розділення по юзерах.
- Немає `userId`.
- MT5-іморти не зберігаються окремо.

### Нова структура

```
localStorage:
  mqvault-user-{userId}-profile   → { UserProfile }
  mqvault-user-{userId}-trading   → { TradingData }
  mqvault-user-{userId}-mt5-imports → [MT5ImportRecord[]]
```

Переваги:
- Чітке розділення по `userId`.
- Готовність до бекенду (бази даних).
- MT5-іморти зберігаються окремо (сирі дані + угоди).
- Можливість експорту/імпорту резервних копій.

## Як це працює

### 1. Ініціалізація

При першому завантаженні сайту:

```ts
const { storage, isLoading } = useUserStorage();
```

- `useUserStorage` викликає `getOrCreateUserStorage(userId)`.
- Якщо є старі дані (`mqvault-trades` тощо) → мігрує їх у нову структуру.
- Якщо нічого немає → створює нове порожнє сховище.

### 2. Доступ до угод

У будь-якому компоненті:

```tsx
import { useTrades } from '@/hooks/use-trades';

function Journal() {
  const { isLoading, trades, createTrade, patchTrade, removeTrade } = useTrades();

  if (isLoading) return <div>Завантаження...</div>;

  return (
    <div>
      {trades.map((trade) => (
        <div key={trade.id}>
          {trade.symbol} — {trade.netPnlUsd} USD
        </div>
      ))}
    </div>
  );
}
```

### 3. Експорт/імпорт

#### Експорт журналу в CSV

```ts
import { downloadTradesCSV } from '@/lib/trade-export';

function ExportButton() {
  const { trades } = useTrades();

  return (
    <button onClick={() => downloadTradesCSV(trades)}>
      Експортувати журнал (CSV)
    </button>
  );
}
```

#### Експорт резервної копії (JSON)

```ts
import { downloadUserStorageBackup } from '@/lib/user-storage-backup';

function BackupButton() {
  const { userId } = useUserStorage();

  return (
    <button onClick={() => downloadUserStorageBackup(userId)}>
      Зберегти резервну копію (JSON)
    </button>
  );
}
```

#### Імпорт резервної копії

```ts
import { uploadAndImportUserStorageBackup } from '@/lib/user-storage-backup';

function ImportButton() {
  const { userId } = useUserStorage();

  return (
    <button
      onClick={() => {
        uploadAndImportUserStorageBackup(userId, (result) => {
          if (result.success) {
            alert('Резервну копію успішно імпортовано!');
          } else {
            alert(`Помилка: ${result.error}`);
          }
        });
      }}
    >
      Імпортувати резервну копію (JSON)
    </button>
  );
}
```

## Наступні кроки

### 1. Підключити нові хуки в компоненти

Замінити старі виклики `useTrades` на нові:

```tsx
// Було (старий код)
import { useTrades } from '@/hooks/old-use-trades';

// Стало (новий код)
import { useTrades } from '@/hooks/use-trades';
```

### 2. Оновити імпорт MT5

У коді, який обробляє імпорт MT5:

```ts
import { addMT5Import } from '@/lib/mt5-imports';
import { createMT5ImportRecord } from '@/lib/mt5-imports';

// Після конвертації CSV/HTML у trades:
const importRecord = createMT5ImportRecord({
  importId: crypto.randomUUID(),
  source: 'MT5_CSV',
  rawFileName: 'history.csv',
  rawRows: parsedRows,
  trades: convertedTrades,
});

addMT5Import(userId, importRecord);
```

### 3. Заміна файлів у `main`

Щоб уникнути конфліктів:

1. **Зроби бекап поточного `main`** (на всяк випадок).
2. **Перенеси нові файли з гілки**:
   - `src/lib/trade-financials.ts`
   - `src/lib/trade-migration.ts`
   - `src/lib/trade-types.ts`
   - `src/lib/user-storage.ts`
   - `src/lib/mt5-imports.ts`
   - `src/lib/trade-export.ts`
   - `src/lib/user-storage-backup.ts`
   - `src/hooks/useUserStorage.ts`
   - `src/hooks/use-trades.ts`
3. **Онови існуючі файли** (якщо потрібно):
   - Перевір, де використовується старий `useTrades`.
   - Заміни імпорт на новий хук.
4. **Протестуй**:
   - Запусти сайт, перевір, що всі угоди завантажуються.
   - Перевір експорт/імпорт.

## Продуктивність

- **Синхронне читання з localStorage** — миттєво.
- **Одне завантаження при старті** — далі дані в пам'яті.
- **Мінімум обчислень** — міграція тільки при першому запуску.
- **Лінива ініціалізація** — профіль і стратегії завантажуються тільки коли потрібно.

## Безпека даних

- Кожен юзер має свій `userId`.
- Дані зберігаються під ключами з `userId` у назві.
- Неможливо перемішати дані різних юзерів.
- Експорт/імпорт резервних копій захищає від втрати даних.

## Посилання

- Гілка: `feature/trade-financial-model`
- Останній коміт: `d616127` (feat(backup): add JSON export/import)
