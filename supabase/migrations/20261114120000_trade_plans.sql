-- Playbook: trade plans — the pre-trade checklist saved BEFORE an entry (ADR 0019).
-- New table only; no existing data changes. The API (src/app/api/trade-plans) re-checks the whole
-- checklist on the server; the CHECK constraints below are the last line, not the gate itself.
-- Rows go with the user and the account (ON DELETE CASCADE); a deleted trade only unlinks (SET NULL).
CREATE TABLE public.trade_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  symbol text NOT NULL CHECK (char_length(symbol) BETWEEN 2 AND 40),
  direction text NOT NULL CHECK (direction IN ('Long', 'Short')),
  at_desk boolean NOT NULL CHECK (at_desk),
  context text NOT NULL CHECK (char_length(context) BETWEEN 10 AND 500),
  poi_type text NOT NULL CHECK (poi_type IN ('fvg', 'swing', 'compression')),
  poi_note text NOT NULL CHECK (char_length(poi_note) BETWEEN 3 AND 300),
  poi_swept boolean NOT NULL CHECK (poi_swept),
  reaction text NOT NULL CHECK (reaction IN ('sweep', 'fvg')),
  bos_timeframe text NOT NULL CHECK (bos_timeframe IN ('M5', 'M15')),
  bos_body_close boolean NOT NULL CHECK (bos_body_close),
  limit_on_fvg boolean NOT NULL CHECK (limit_on_fvg),
  m3_refined boolean NOT NULL DEFAULT false,
  entry numeric NOT NULL CHECK (entry > 0),
  stop numeric NOT NULL CHECK (stop > 0),
  target numeric NOT NULL CHECK (target > 0),
  rr numeric NOT NULL CHECK (rr > 0),
  risk_pct numeric NOT NULL CHECK (risk_pct > 0 AND risk_pct <= 20),
  risk_exception text NOT NULL DEFAULT 'none' CHECK (risk_exception IN ('none', 'add_on', 'metal_lot')),
  screenshot_url text NOT NULL CHECK (char_length(screenshot_url) BETWEEN 8 AND 500 AND screenshot_url ~* '^https?://'),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 10 AND 1000),
  -- Snapshot of what the server checked at save time (window, day counters, risk state).
  gate jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(gate) = 'object' AND octet_length(gate::text) <= 4096),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  trade_id uuid REFERENCES public.journal_trades (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX trade_plans_user_created_idx ON public.trade_plans (user_id, created_at DESC);
CREATE INDEX trade_plans_account_idx ON public.trade_plans (account_id);
CREATE UNIQUE INDEX trade_plans_trade_unique ON public.trade_plans (trade_id) WHERE trade_id IS NOT NULL;

-- RLS (ADR 0018): a user reaches only their own rows, and only on their own accounts.
ALTER TABLE public.trade_plans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trade_plans FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_plans TO authenticated;
GRANT ALL ON public.trade_plans TO service_role;
CREATE POLICY trade_plans_select_own ON public.trade_plans FOR SELECT TO authenticated
  USING (user_id = (SELECT private.current_app_user_id()));
CREATE POLICY trade_plans_insert_own ON public.trade_plans FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT private.current_app_user_id()));
CREATE POLICY trade_plans_update_own ON public.trade_plans FOR UPDATE TO authenticated
  USING (user_id = (SELECT private.current_app_user_id())) WITH CHECK (user_id = (SELECT private.current_app_user_id()));
CREATE POLICY trade_plans_delete_own ON public.trade_plans FOR DELETE TO authenticated
  USING (user_id = (SELECT private.current_app_user_id()));
CREATE POLICY trade_plans_insert_own_account ON public.trade_plans AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (private.owns_account(account_id));
CREATE POLICY trade_plans_update_own_account ON public.trade_plans AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (true) WITH CHECK (private.owns_account(account_id));
-- A linked trade must be the user's own trade.
CREATE POLICY trade_plans_link_own_trade ON public.trade_plans AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (true) WITH CHECK (trade_id IS NULL OR EXISTS (
    SELECT 1 FROM public.journal_trades t WHERE t.id = trade_id AND t.user_id = (SELECT private.current_app_user_id())
  ));
