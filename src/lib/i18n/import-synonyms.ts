/**
 * Ukrainian words that CSV files use for trade columns and values. Input data for the importer
 * (src/lib/journal/csv-import.ts), not UI text — kept here with the other language data.
 */
export const UK_HEADER_ALIASES: Record<string, string[]> = {
  symbol: ["торгова пара", "пара", "інструмент", "символ", "актив"],
  direction: ["напрямок", "тип", "позиція", "сторона"],
  opened_at: ["відкриття", "час відкриття", "дата відкриття", "дата і час відкриття"],
  open_date: ["дата"],
  open_time: ["час"],
  closed_at: ["закриття", "час закриття", "дата закриття"],
  entry_price: ["ціна", "ціна входу", "вхід", "ціна відкриття"],
  exit_price: ["ціна виходу", "вихід", "ціна закриття"],
  stop_loss: ["стоп", "стоп лос", "стоп-лос"],
  take_profit: ["тейк", "тейк профіт", "тейк-профіт", "ціль"],
  volume: ["лоти", "лот", "обсяг", "об'єм", "розмір"],
  gross_pnl: ["прибуток", "результат"],
  net_pnl: ["чистий прибуток", "чистий"],
  commission: ["комісія"],
  swap: ["своп"],
  fee: ["збір"],
  risk_percent: ["ризик", "ризик %"],
  risk_amount: ["сума ризику"],
  setup: ["сетап", "модель", "стратегія"],
  emotion: ["емоція", "емоції", "настрій"],
  mistake: ["помилка", "помилки"],
  followed_plan: ["за планом", "за правилами"],
  entry_reason: ["причина входу", "причина", "критерії входу"],
  notes: ["нотатки", "нотатка", "коментар"],
  screenshot_url: ["скріншот", "графік"],
  external_id: ["тикет", "ордер", "угода"],
  market: ["ринок"],
};
export const UK_LONG = ["купівля", "купити", "лонг", "бай"];
export const UK_SHORT = ["продаж", "продати", "шорт", "сел"];
export const UK_YES = ["так"];
export const UK_NO = ["ні"];
export const UK_EMOTIONS: Record<string, string> = { "спокій": "Calm", "нейтрально": "Neutral", "втома": "Tired", "злість": "Angry" };
