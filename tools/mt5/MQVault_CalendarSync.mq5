//+------------------------------------------------------------------+
//| MQVault_CalendarSync.mq5                                         |
//| Expert Advisor: pushes new and changed MT5 economic calendar     |
//| values (actual, forecast, revisions) to MQVault while the        |
//| terminal is running. No trading functions.                       |
//| Network: WebRequest to InpUrl only (add it in Tools > Options >  |
//| Expert Advisors > Allow WebRequest for listed URL).              |
//| See docs/decisions/0015-calendar-sync-from-owner-mt5.md          |
//+------------------------------------------------------------------+
#property copyright "Trade Vault"
#property version   "1.00"
#property description "Sends economic calendar values to MQVault. No trading."

input string InpUrl             = "https://mqvault.vercel.app/api/economic-calendar/sync"; // Sync endpoint
input string InpToken           = "";                                 // CALENDAR_SYNC_TOKEN (same as in Vercel)
input string InpCurrencies      = "USD,EUR,GBP,JPY,CHF,CAD,AUD,NZD";  // Currencies
input ENUM_CALENDAR_EVENT_IMPORTANCE InpMinImportance = CALENDAR_IMPORTANCE_MODERATE; // Min importance
input bool   InpIncludeHolidays = true;                               // Include bank holidays
input int    InpBackfillDays    = 7;                                  // On start: re-send past days
input int    InpDaysAhead       = 14;                                 // On start: and days ahead
input int    InpPollSeconds     = 60;                                 // Check for changes every N seconds
input int    InpBatchRows       = 300;                                // Rows per request

ulong    g_changeId     = 0;
bool     g_backfillDone = false;
string   g_currencies[];
datetime g_lastOk       = 0;
long     g_sentTotal    = 0;
string   g_status       = "starting";

// event cache (calendar metadata does not change while running)
ulong            g_evIds[];
MqlCalendarEvent g_evs[];
string           g_evCountry[];
string           g_evCurrency[];

//--- helpers ---------------------------------------------------------
string JsonStr(const string s)
  {
   string r = s;
   StringReplace(r, "\\", "\\\\");
   StringReplace(r, "\"", "\\\"");
   StringReplace(r, "\r", "\\r");
   StringReplace(r, "\n", "\\n");
   StringReplace(r, "\t", "\\t");
   return "\"" + r + "\"";
  }

string ValueToStr(const long v)
  {
   if(v == LONG_MIN)
      return "";
   return DoubleToString((double)v / 1000000.0, 6);
  }

string TimeIso(const datetime t)
  {
   MqlDateTime d;
   TimeToStruct(t, d);
   return StringFormat("%04d-%02d-%02d %02d:%02d:%02d", d.year, d.mon, d.day, d.hour, d.min, d.sec);
  }

string DateIso(const datetime t)
  {
   MqlDateTime d;
   TimeToStruct(t, d);
   return StringFormat("%04d-%02d-%02d", d.year, d.mon, d.day);
  }

// MT5 reports every calendar time with the server's CURRENT offset; the server converts to UTC with it.
int OffsetMinutes()
  {
   int offsetSec = (int)(TimeTradeServer() - TimeGMT());
   return (int)MathRound(offsetSec / 900.0) * 15;
  }

bool WantedCurrency(const string ccy)
  {
   for(int i = 0; i < ArraySize(g_currencies); i++)
      if(g_currencies[i] == ccy)
         return true;
   return false;
  }

int EventIndex(const ulong id)
  {
   int n = ArraySize(g_evIds);
   for(int i = 0; i < n; i++)
      if(g_evIds[i] == id)
         return i;
   MqlCalendarEvent ev;
   if(!CalendarEventById(id, ev))
      return -1;
   MqlCalendarCountry country;
   string code = "", ccy = "";
   if(CalendarCountryById(ev.country_id, country))
     {
      code = country.code;
      ccy  = country.currency;
     }
   ArrayResize(g_evIds, n + 1);
   ArrayResize(g_evs, n + 1);
   ArrayResize(g_evCountry, n + 1);
   ArrayResize(g_evCurrency, n + 1);
   g_evIds[n]      = id;
   g_evs[n]        = ev;
   g_evCountry[n]  = code;
   g_evCurrency[n] = ccy;
   return n;
  }

// One value as JSON with the same fields as the export CSV; empty string when filtered out.
string RowJson(const MqlCalendarValue &v)
  {
   int k = EventIndex(v.event_id);
   if(k < 0)
      return "";
   if(!WantedCurrency(g_evCurrency[k]))
      return "";
   bool isHoliday = (g_evs[k].type == CALENDAR_TYPE_HOLIDAY);
   if(isHoliday && !InpIncludeHolidays)
      return "";
   if(!isHoliday && (int)g_evs[k].importance < (int)InpMinImportance)
      return "";

   return "{" +
          "\"value_id\":" + JsonStr((string)v.id) + "," +
          "\"event_id\":" + JsonStr((string)v.event_id) + "," +
          "\"event_code\":" + JsonStr(g_evs[k].event_code) + "," +
          "\"event_name\":" + JsonStr(g_evs[k].name) + "," +
          "\"country_code\":" + JsonStr(g_evCountry[k]) + "," +
          "\"currency\":" + JsonStr(g_evCurrency[k]) + "," +
          "\"importance\":" + JsonStr(EnumToString(g_evs[k].importance)) + "," +
          "\"event_type\":" + JsonStr(EnumToString(g_evs[k].type)) + "," +
          "\"sector\":" + JsonStr(EnumToString(g_evs[k].sector)) + "," +
          "\"frequency\":" + JsonStr(EnumToString(g_evs[k].frequency)) + "," +
          "\"time_mode\":" + JsonStr(EnumToString(g_evs[k].time_mode)) + "," +
          "\"unit\":" + JsonStr(EnumToString(g_evs[k].unit)) + "," +
          "\"multiplier\":" + JsonStr(EnumToString(g_evs[k].multiplier)) + "," +
          "\"digits\":" + JsonStr(IntegerToString(g_evs[k].digits)) + "," +
          "\"server_time\":" + JsonStr(TimeIso(v.time)) + "," +
          "\"period\":" + JsonStr(DateIso(v.period)) + "," +
          "\"revision\":" + JsonStr(IntegerToString(v.revision)) + "," +
          "\"actual\":" + JsonStr(ValueToStr(v.actual_value)) + "," +
          "\"forecast\":" + JsonStr(ValueToStr(v.forecast_value)) + "," +
          "\"previous\":" + JsonStr(ValueToStr(v.prev_value)) + "," +
          "\"revised_previous\":" + JsonStr(ValueToStr(v.revised_prev_value)) +
          "}";
  }

void AddRows(const MqlCalendarValue &vals[], string &rows[])
  {
   int nv = ArraySize(vals);
   for(int i = 0; i < nv; i++)
     {
      string row = RowJson(vals[i]);
      if(row == "")
         continue;
      int n = ArraySize(rows);
      ArrayResize(rows, n + 1);
      rows[n] = row;
     }
  }

bool PostBatch(const string &rows[], const int from, const int count)
  {
   string body = "{\"offset_min\":" + IntegerToString(OffsetMinutes()) + ",\"rows\":[";
   for(int i = from; i < from + count; i++)
     {
      if(i > from)
         body += ",";
      body += rows[i];
     }
   body += "]}";

   char data[];
   int len = StringToCharArray(body, data, 0, WHOLE_ARRAY, CP_UTF8);
   if(len > 0)
      ArrayResize(data, len - 1);   // drop the terminating zero
   char   result[];
   string resultHeaders;
   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + InpToken + "\r\n";

   ResetLastError();
   int code = WebRequest("POST", InpUrl, headers, 30000, data, result, resultHeaders);
   if(code == -1)
     {
      int err = GetLastError();
      if(err == 4014)
         g_status = "add the URL in Tools > Options > Expert Advisors > Allow WebRequest: " + InpUrl;
      else
         g_status = "WebRequest error " + IntegerToString(err);
      return false;
     }
   string response = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   if(code != 200)
     {
      g_status = "HTTP " + IntegerToString(code) + ": " + StringSubstr(response, 0, 160);
      return false;
     }
   g_status = StringSubstr(response, 0, 160);
   return true;
  }

bool SendRows(const string &rows[])
  {
   int total = ArraySize(rows);
   int batch = InpBatchRows < 1 ? 1 : (InpBatchRows > 1000 ? 1000 : InpBatchRows);
   for(int from = 0; from < total; from += batch)
     {
      int count = MathMin(batch, total - from);
      if(!PostBatch(rows, from, count))
        {
         PrintFormat("MQVault sync: send failed (%s)", g_status);
         return false;
        }
      g_sentTotal += count;
     }
   g_lastOk = TimeLocal();
   return true;
  }

// Re-sends a window around now: catches up on what changed while the terminal was closed.
bool Backfill()
  {
   datetime now  = TimeTradeServer();
   datetime from = now - (datetime)(InpBackfillDays * 86400);
   datetime to   = now + (datetime)(InpDaysAhead * 86400);
   string rows[];
   for(int c = 0; c < ArraySize(g_currencies); c++)
     {
      MqlCalendarValue vals[];
      ResetLastError();
      CalendarValueHistory(vals, from, to, NULL, g_currencies[c]);
      int err = GetLastError();
      if(ArraySize(vals) == 0 && err != 0 && err != ERR_CALENDAR_NO_DATA)
        {
         g_status = StringFormat("calendar not ready for %s (error %d), retrying", g_currencies[c], err);
         return false;
        }
      AddRows(vals, rows);
     }
   if(!SendRows(rows))
      return false;
   PrintFormat("MQVault sync: backfill sent %d rows (%s)", ArraySize(rows), g_status);
   return true;
  }

void ShowStatus()
  {
   string last = g_lastOk == 0 ? "never" : TimeToString(g_lastOk, TIME_DATE | TIME_MINUTES);
   Comment(StringFormat("MQVault calendar sync\nLast OK: %s · rows sent: %I64d\n%s", last, g_sentTotal, g_status));
  }

//--- events ----------------------------------------------------------
int OnInit()
  {
   if(StringLen(InpToken) < 32)
     {
      Alert("MQVault sync: set InpToken (CALENDAR_SYNC_TOKEN, at least 32 characters).");
      return INIT_PARAMETERS_INCORRECT;
     }
   if(StringFind(InpUrl, "https://") != 0)
     {
      Alert("MQVault sync: InpUrl must start with https://");
      return INIT_PARAMETERS_INCORRECT;
     }
   string parts[];
   int n = StringSplit(InpCurrencies, ',', parts);
   ArrayResize(g_currencies, 0);
   for(int i = 0; i < n; i++)
     {
      string ccy = parts[i];
      StringTrimLeft(ccy);
      StringTrimRight(ccy);
      StringToUpper(ccy);
      if(ccy == "")
         continue;
      int k = ArraySize(g_currencies);
      ArrayResize(g_currencies, k + 1);
      g_currencies[k] = ccy;
     }

   // Remember the calendar state BEFORE the backfill so nothing that changes meanwhile is missed.
   MqlCalendarValue none[];
   CalendarValueLast(g_changeId, none);

   // The first tick (in 5 s) does the backfill, so attaching the EA never blocks the terminal.
   EventSetTimer(5);
   ShowStatus();
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason)
  {
   EventKillTimer();
   Comment("");
  }

void OnTimer()
  {
   if(!g_backfillDone)
     {
      g_backfillDone = Backfill();
      if(g_backfillDone)
         EventSetTimer(InpPollSeconds < 10 ? 10 : InpPollSeconds);
      ShowStatus();
      return;
     }
   ulong id = g_changeId;
   MqlCalendarValue vals[];
   CalendarValueLast(id, vals);
   if(ArraySize(vals) > 0)
     {
      string rows[];
      AddRows(vals, rows);
      // Advance only after the server accepted the rows: a failed send is retried on the next tick.
      if(ArraySize(rows) == 0 || SendRows(rows))
        {
         g_changeId = id;
         if(ArraySize(rows) > 0)
            PrintFormat("MQVault sync: sent %d changed values (%s)", ArraySize(rows), g_status);
        }
     }
   else
      if(id != 0)
         g_changeId = id;
   ShowStatus();
  }

void OnTick() {}
//+------------------------------------------------------------------+
