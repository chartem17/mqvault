//+------------------------------------------------------------------+
//| MQVault_CalendarExport.mq5                                       |
//| Exports MT5 economic calendar history to CSV.                    |
//| Read-only: no trading functions, no network access.              |
//+------------------------------------------------------------------+
#property copyright "Trade Vault"
#property version   "1.00"
#property script_show_inputs

input datetime InpFrom            = D'2017.01.01 00:00';          // Start date
input int      InpDaysAhead       = 14;                           // Days ahead (upcoming events)
input string   InpCurrencies      = "USD,EUR,GBP,JPY,CHF,CAD,AUD,NZD";
input ENUM_CALENDAR_EVENT_IMPORTANCE InpMinImportance = CALENDAR_IMPORTANCE_MODERATE; // Min importance
input bool     InpIncludeHolidays = true;                         // Include bank holidays
input string   InpFilePrefix      = "mqvault_cal_";               // Output files: <prefix><CCY>.csv in MQL5\Files
input bool     InpOverwrite       = false;                        // Re-export currencies that already have a file

#define CSV_HEADER "value_id,event_id,event_code,event_name,country_code,currency,importance,event_type," \
                   "sector,frequency,time_mode,unit,multiplier,digits,server_time,server_utc_offset_now_min," \
                   "period,revision,actual,forecast,previous,revised_previous,impact_type\n"

//--- CSV helpers
string CsvEscape(const string s)
  {
   string r = s;
   StringReplace(r, "\"", "\"\"");
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

//--- fetch values for one event with retries on timeout
bool FetchValues(const ulong event_id, MqlCalendarValue &vals[], const datetime from, const datetime to)
  {
   for(int attempt = 0; attempt < 3; attempt++)
     {
      ResetLastError();
      if(CalendarValueHistoryByEvent(event_id, vals, from, to))
         return true;
      int err = GetLastError();
      if(err == ERR_CALENDAR_NO_DATA)
        {
         ArrayResize(vals, 0);
         return true;
        }
      Sleep(500);
     }
   return false;
  }

//+------------------------------------------------------------------+
void OnStart()
  {
   datetime serverNow = TimeTradeServer();
   datetime to        = serverNow + (datetime)(InpDaysAhead * 86400);

   // current broker offset from UTC, rounded to 15 minutes (for reference only)
   int offsetSec = (int)(TimeTradeServer() - TimeGMT());
   int offsetMin = (int)MathRound(offsetSec / 900.0) * 15;

   string cur[];
   int nCur = StringSplit(InpCurrencies, ',', cur);
   long totalRows = 0;
   int  failedEvents = 0;
   string doneList = "", skippedList = "", failedList = "";

   for(int c = 0; c < nCur && !IsStopped(); c++)
     {
      string ccy = cur[c];
      StringTrimLeft(ccy);
      StringTrimRight(ccy);
      StringToUpper(ccy);
      if(ccy == "")
         continue;

      // one file per currency; a finished file means this currency is done
      string finalName = InpFilePrefix + ccy + ".csv";
      string partName  = finalName + ".part";
      if(!InpOverwrite && FileIsExist(finalName))
        {
         PrintFormat("MQVault: %s already exported (%s), skipping", ccy, finalName);
         skippedList += ccy + " ";
         continue;
        }

      MqlCalendarEvent events[];
      ResetLastError();
      int nEv = CalendarEventByCurrency(ccy, events);
      if(nEv <= 0)
        {
         PrintFormat("MQVault: %s - no events (error %d). Calendar may still be syncing, try again in a minute.", ccy, GetLastError());
         failedList += ccy + " ";
         continue;
        }

      int h = FileOpen(partName, FILE_WRITE | FILE_TXT | FILE_ANSI, 0, CP_UTF8);
      if(h == INVALID_HANDLE)
        {
         PrintFormat("MQVault: cannot open %s, error %d", partName, GetLastError());
         failedList += ccy + " ";
         continue;
        }
      FileWriteString(h, CSV_HEADER);

      long ccyRows = 0;
      for(int e = 0; e < nEv && !IsStopped(); e++)
        {
         bool isHoliday = (events[e].type == CALENDAR_TYPE_HOLIDAY);
         if(isHoliday && !InpIncludeHolidays)
            continue;
         if(!isHoliday && (int)events[e].importance < (int)InpMinImportance)
            continue;

         MqlCalendarCountry country;
         string countryCode = "";
         if(CalendarCountryById(events[e].country_id, country))
            countryCode = country.code;

         string evPrefix =
            (string)events[e].id + "," +
            CsvEscape(events[e].event_code) + "," +
            CsvEscape(events[e].name) + "," +
            countryCode + "," +
            ccy + "," +
            EnumToString(events[e].importance) + "," +
            EnumToString(events[e].type) + "," +
            EnumToString(events[e].sector) + "," +
            EnumToString(events[e].frequency) + "," +
            EnumToString(events[e].time_mode) + "," +
            EnumToString(events[e].unit) + "," +
            EnumToString(events[e].multiplier) + "," +
            IntegerToString(events[e].digits) + ",";

         // yearly chunks to avoid calendar timeouts on wide ranges
         for(datetime from = InpFrom; from < to && !IsStopped(); )
           {
            datetime chunkTo = from + (datetime)(365 * 86400);
            if(chunkTo > to)
               chunkTo = to;

            MqlCalendarValue vals[];
            if(!FetchValues(events[e].id, vals, from, chunkTo))
              {
               failedEvents++;
               PrintFormat("MQVault: failed %s %s [%s..%s], error %d",
                           ccy, events[e].name, DateIso(from), DateIso(chunkTo), GetLastError());
              }
            else
              {
               int nv = ArraySize(vals);
               for(int i = 0; i < nv; i++)
                 {
                  string line =
                     (string)vals[i].id + "," +
                     evPrefix +
                     TimeIso(vals[i].time) + "," +
                     IntegerToString(offsetMin) + "," +
                     DateIso(vals[i].period) + "," +
                     IntegerToString(vals[i].revision) + "," +
                     ValueToStr(vals[i].actual_value) + "," +
                     ValueToStr(vals[i].forecast_value) + "," +
                     ValueToStr(vals[i].prev_value) + "," +
                     ValueToStr(vals[i].revised_prev_value) + "," +
                     EnumToString(vals[i].impact_type) + "\n";
                  FileWriteString(h, line);
                  ccyRows++;
                 }
              }
            from = chunkTo + 1;
           }
         FileFlush(h);
         Comment(StringFormat("MQVault export: %s (%d/%d) - event %d/%d, %I64d rows",
                              ccy, c + 1, nCur, e + 1, nEv, ccyRows));
        }

      FileClose(h);
      totalRows += ccyRows;

      if(IsStopped())
        {
         PrintFormat("MQVault: %s interrupted, partial file left as %s", ccy, partName);
         failedList += ccy + " ";
         break;
        }

      // mark currency as finished only after a complete pass
      if(FileMove(partName, 0, finalName, FILE_REWRITE))
        {
         PrintFormat("MQVault: %s - %I64d rows -> %s", ccy, ccyRows, finalName);
         doneList += ccy + " ";
        }
      else
        {
         PrintFormat("MQVault: %s - cannot rename %s, error %d", ccy, partName, GetLastError());
         failedList += ccy + " ";
        }
     }

   Comment("");

   string folder = TerminalInfoString(TERMINAL_DATA_PATH) + "\\MQL5\\Files";
   Alert(StringFormat("MQVault: finished. Done: %s| Skipped: %s| Failed: %s| %I64d rows, %d failed requests. Folder: %s",
                      doneList, skippedList, failedList, totalRows, failedEvents, folder));
  }
//+------------------------------------------------------------------+
