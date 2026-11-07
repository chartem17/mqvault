-- Restored 2026-11-07 from supabase_migrations.schema_migrations (applied 2026-10-11).
-- Already applied in Supabase. Do not edit.

create table if not exists public.market_instruments (
  id uuid primary key default gen_random_uuid(),
  symbol text not null unique,
  display_symbol text not null,
  market text not null check (market in ('Crypto','Forex','Commodities','Energy','Index','Stocks')),
  asset_class text not null check (asset_class in ('crypto','forex','metal','agriculture','energy','index','stock')),
  provider text not null check (provider in ('binance','twelve-data')),
  provider_symbol text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists market_instruments_market_idx on public.market_instruments (market, sort_order);

alter table public.market_instruments enable row level security;

create policy "market_instruments_read_authenticated"
  on public.market_instruments for select
  to authenticated
  using (true);

insert into public.market_instruments (symbol, display_symbol, market, asset_class, provider, provider_symbol)
select b || 'USDT', b || '/USDT', 'Crypto', 'crypto', 'binance', b || 'USDT'
from unnest(array['BTC','ETH','BNB','SOL','XRP','ADA','DOGE','AVAX','DOT','LINK','LTC','TRX','ATOM','NEAR','UNI','APT','ARB','OP','SUI','TON','SHIB','PEPE','INJ','FIL','ETC','BCH','XLM','AAVE','HBAR','POL']) as b
on conflict (symbol) do nothing;

insert into public.market_instruments (symbol, display_symbol, market, asset_class, provider, provider_symbol)
select p, left(p,3) || '/' || right(p,3), 'Forex', 'forex', 'twelve-data', left(p,3) || '/' || right(p,3)
from unnest(array['EURUSD','GBPUSD','USDJPY','USDCHF','USDCAD','AUDUSD','NZDUSD','EURGBP','EURJPY','EURCHF','EURAUD','EURCAD','EURNZD','GBPJPY','GBPCHF','GBPAUD','GBPCAD','GBPNZD','AUDJPY','AUDCAD','AUDCHF','AUDNZD','NZDJPY','NZDCAD','NZDCHF','CADJPY','CADCHF','CHFJPY','USDMXN','USDZAR','USDTRY','USDSEK','USDNOK','USDSGD','USDPLN','USDCNH']) as p
on conflict (symbol) do nothing;

insert into public.market_instruments (symbol, display_symbol, market, asset_class, provider, provider_symbol) values
('XAUUSD','XAU/USD','Commodities','metal','twelve-data','XAU/USD'),
('XAGUSD','XAG/USD','Commodities','metal','twelve-data','XAG/USD'),
('XPTUSD','XPT/USD','Commodities','metal','twelve-data','XPT/USD'),
('XPDUSD','XPD/USD','Commodities','metal','twelve-data','XPD/USD'),
('XCUUSD','Copper','Commodities','metal','twelve-data','XCU/USD'),
('WHEAT','Wheat','Commodities','agriculture','twelve-data','W_1'),
('CORN','Corn','Commodities','agriculture','twelve-data','C_1'),
('SOYBEAN','Soybeans','Commodities','agriculture','twelve-data','S_1'),
('COFFEE','Coffee','Commodities','agriculture','twelve-data','KC1'),
('SUGAR','Sugar','Commodities','agriculture','twelve-data','SB1'),
('COTTON','Cotton','Commodities','agriculture','twelve-data','CT1'),
('COCOA','Cocoa','Commodities','agriculture','twelve-data','CC1'),
('WTIUSD','WTI Crude','Energy','energy','twelve-data','WTI/USD'),
('BRENTUSD','Brent Crude','Energy','energy','twelve-data','XBR/USD'),
('NGUSD','Natural Gas','Energy','energy','twelve-data','NG/USD'),
('HEATINGOIL','Heating Oil','Energy','energy','twelve-data','HO1'),
('GASOLINE','RBOB Gasoline','Energy','energy','twelve-data','RB1'),
('XLE','Energy Sector ETF','Energy','energy','twelve-data','XLE'),
('XOM','Exxon Mobil','Energy','energy','twelve-data','XOM'),
('CVX','Chevron','Energy','energy','twelve-data','CVX'),
('COP','ConocoPhillips','Energy','energy','twelve-data','COP'),
('SLB','Schlumberger','Energy','energy','twelve-data','SLB'),
('US30','Dow Jones','Index','index','twelve-data','DIA'),
('US500','S&P 500','Index','index','twelve-data','SPY'),
('NAS100','Nasdaq 100','Index','index','twelve-data','QQQ'),
('US2000','Russell 2000','Index','index','twelve-data','IWM'),
('GER40','DAX 40','Index','index','twelve-data','EWG'),
('UK100','FTSE 100','Index','index','twelve-data','EWU'),
('FRA40','CAC 40','Index','index','twelve-data','EWQ'),
('JPN225','Nikkei 225','Index','index','twelve-data','EWJ'),
('HK50','Hang Seng','Index','index','twelve-data','EWH'),
('CHN50','China Large-Cap','Index','index','twelve-data','FXI'),
('AUS200','ASX 200','Index','index','twelve-data','EWA'),
('EEM','Emerging Markets','Index','index','twelve-data','EEM'),
('AAPL','Apple','Stocks','stock','twelve-data','AAPL'),
('MSFT','Microsoft','Stocks','stock','twelve-data','MSFT'),
('NVDA','NVIDIA','Stocks','stock','twelve-data','NVDA'),
('GOOGL','Alphabet','Stocks','stock','twelve-data','GOOGL'),
('AMZN','Amazon','Stocks','stock','twelve-data','AMZN'),
('META','Meta','Stocks','stock','twelve-data','META'),
('TSLA','Tesla','Stocks','stock','twelve-data','TSLA'),
('AVGO','Broadcom','Stocks','stock','twelve-data','AVGO'),
('AMD','AMD','Stocks','stock','twelve-data','AMD'),
('NFLX','Netflix','Stocks','stock','twelve-data','NFLX'),
('INTC','Intel','Stocks','stock','twelve-data','INTC'),
('CRM','Salesforce','Stocks','stock','twelve-data','CRM'),
('ORCL','Oracle','Stocks','stock','twelve-data','ORCL'),
('ADBE','Adobe','Stocks','stock','twelve-data','ADBE'),
('QCOM','Qualcomm','Stocks','stock','twelve-data','QCOM'),
('PLTR','Palantir','Stocks','stock','twelve-data','PLTR'),
('COIN','Coinbase','Stocks','stock','twelve-data','COIN'),
('MSTR','MicroStrategy','Stocks','stock','twelve-data','MSTR'),
('UBER','Uber','Stocks','stock','twelve-data','UBER'),
('SHOP','Shopify','Stocks','stock','twelve-data','SHOP'),
('JPM','JPMorgan','Stocks','stock','twelve-data','JPM'),
('BAC','Bank of America','Stocks','stock','twelve-data','BAC'),
('GS','Goldman Sachs','Stocks','stock','twelve-data','GS'),
('V','Visa','Stocks','stock','twelve-data','V'),
('MA','Mastercard','Stocks','stock','twelve-data','MA'),
('BRK.B','Berkshire Hathaway','Stocks','stock','twelve-data','BRK.B'),
('WMT','Walmart','Stocks','stock','twelve-data','WMT'),
('COST','Costco','Stocks','stock','twelve-data','COST'),
('KO','Coca-Cola','Stocks','stock','twelve-data','KO'),
('PEP','PepsiCo','Stocks','stock','twelve-data','PEP'),
('MCD','McDonald''s','Stocks','stock','twelve-data','MCD'),
('NKE','Nike','Stocks','stock','twelve-data','NKE'),
('DIS','Disney','Stocks','stock','twelve-data','DIS'),
('JNJ','Johnson & Johnson','Stocks','stock','twelve-data','JNJ'),
('UNH','UnitedHealth','Stocks','stock','twelve-data','UNH'),
('LLY','Eli Lilly','Stocks','stock','twelve-data','LLY'),
('PFE','Pfizer','Stocks','stock','twelve-data','PFE'),
('BA','Boeing','Stocks','stock','twelve-data','BA'),
('CAT','Caterpillar','Stocks','stock','twelve-data','CAT'),
('F','Ford','Stocks','stock','twelve-data','F')
on conflict (symbol) do nothing;
