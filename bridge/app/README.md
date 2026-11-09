# MQVault Bridge — програма для ПК (етап 2)

Читає історію угод з **уже запущених** терміналів MT5 цього ПК і надсилає її в журнал. Дизайн і доказ безпеки — [ADR 0016](../../docs/decisions/0016-mt5-desktop-bridge.md), [features/mt5-bridge.md](../../docs/features/mt5-bridge.md) (§9.5 — стан цього етапу).

| Модуль | Роль |
|---|---|
| `mt5_reader.py` | єдиний, хто торкається MT5, і лише функціями з `READ_ONLY`; ім'я власника рахунку й коментарі не читаються в payload |
| `worker.py` | окремий процес на кожен термінал: читає й кладе в чергу; **без мережі й без ключа** |
| `outbox.py` | черга SQLite (WAL, `synchronous=FULL`); елемент зникає лише після `2xx` |
| `sender.py` | єдиний, хто ходить у мережу: по одному запиту, тож лічильник `seq` завжди зростає; відповіді сервера — лише статуси, команд немає |
| `keystore.py` | ключ ECDSA P-256, зашифрований DPAPI поточного користувача (`%LOCALAPPDATA%\MQVault\Bridge\device.key`) |
| `pairing.py` | код підключення → сторінка підтвердження → `device_id` |
| `supervisor.py` | один екземпляр на сесію Windows; шукає термінали кожні 15 с, перезапускає worker'ів |

Розробка (Windows, Python 3.13):

```bash
python -m pip install -r bridge/app/requirements.txt
```

```bash
python -I bridge/app/tests/test_bridge.py -v
```

```bash
cd bridge/app && python -m mqvault_bridge --server http://localhost:3000 --no-browser
```

Встановлена програма запускається без аргументів (адресу сервера вшиває інсталятор, етап 3). Дані програми: `%LOCALAPPDATA%\MQVault\Bridge` (`MQVAULT_BRIDGE_HOME` — для тестів).
