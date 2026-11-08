# MQVault Bridge — прототип етапу 0

Не продукт: дві утиліти, що перевіряють припущення [ADR 0015](../../docs/decisions/0015-mt5-desktop-bridge.md) на реальному ПК. Результати — у [features/mt5-bridge.md, розділ 9](../../docs/features/mt5-bridge.md#9-результати-етапу-0-прототип).

| Файл | Що робить |
|---|---|
| `probe.py` | Знаходить **вже запущені** `terminal64.exe` (Win32, без залежностей), у окремому процесі на кожен приєднується через `MetaTrader5.initialize(path=…)` без логіна/пароля, читає `terminal_info`, `account_info`, усю історію deals і тік для зсуву часу. Номер рахунку й суми маскуються. Сам термінал ніколи не запускає. |
| `check_readonly.py` | Прототип CI-перевірки тверджень S1/S2: AST-сканування на торгові виклики, `eval/exec/subprocess`, рядки `order_send`/`password`/`accounts.dat`, і `initialize()` лише з `path`/`timeout`. |

```bash
python -m pip install MetaTrader5
```

```bash
python -I probe.py
```

```bash
python -I check_readonly.py
```

Потрібно: Windows, 64-бітний Python 3.10+, відкритий MT5, у якому виконано вхід у рахунок.
