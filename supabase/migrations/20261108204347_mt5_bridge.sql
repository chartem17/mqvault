-- MQVault Bridge, stage 1 (ADR 0015, docs/features/mt5-bridge.md §6).
-- Approved by the owner 2026-11-08.
--
-- Same access model as every other table: RLS on, no client policies, the server talks to the database with the
-- service key only. Nothing here changes existing tables; deleting an account or a trade keeps working unchanged:
--  * bridge_terminal_accounts.account_id → accounts ON DELETE SET NULL (matched_at stays, so the MT5 account is
--    remembered as "ignored" and never re-created automatically);
--  * bridge_positions.trade_id → journal_trades ON DELETE SET NULL (synced_at stays, so a deleted trade is never revived).

-- Pairing requests (RFC 8628-style). Only the SHA-256 of the user code is stored.
CREATE TABLE public.bridge_pairings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_code_hash text NOT NULL UNIQUE CHECK (user_code_hash ~ '^[0-9a-f]{64}$'),
  public_key text NOT NULL CHECK (char_length(public_key) BETWEEN 80 AND 200),
  key_fingerprint text NOT NULL CHECK (key_fingerprint ~ '^[0-9a-f]{64}$'),
  key_storage text NOT NULL DEFAULT 'unknown' CHECK (key_storage IN ('tpm', 'cng', 'dpapi', 'unknown')),
  device_name text NOT NULL CHECK (char_length(device_name) BETWEEN 1 AND 80),
  os text NOT NULL CHECK (char_length(os) BETWEEN 1 AND 80),
  bridge_version text NOT NULL CHECK (char_length(bridge_version) BETWEEN 5 AND 20),
  expires_at timestamptz NOT NULL,
  approved_at timestamptz,
  approved_by uuid REFERENCES public.app_users(id) ON DELETE CASCADE,
  device_id uuid,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Paired PCs. last_seq is the replay guard: a request is accepted only by
-- UPDATE ... SET last_seq = $seq WHERE id = $id AND last_seq < $seq AND revoked_at IS NULL RETURNING ...
CREATE TABLE public.bridge_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  os text NOT NULL CHECK (char_length(os) BETWEEN 1 AND 80),
  public_key text NOT NULL CHECK (char_length(public_key) BETWEEN 80 AND 200),
  key_fingerprint text NOT NULL UNIQUE CHECK (key_fingerprint ~ '^[0-9a-f]{64}$'),
  key_storage text NOT NULL DEFAULT 'unknown' CHECK (key_storage IN ('tpm', 'cng', 'dpapi', 'unknown')),
  last_seq bigint NOT NULL DEFAULT 0 CHECK (last_seq >= 0),
  bridge_version text,
  last_seen_at timestamptz,
  last_sync_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bridge_devices_user_id_idx ON public.bridge_devices (user_id);
ALTER TABLE public.bridge_pairings
  ADD CONSTRAINT bridge_pairings_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.bridge_devices(id) ON DELETE CASCADE;
CREATE INDEX bridge_pairings_device_id_idx ON public.bridge_pairings (device_id);
CREATE INDEX bridge_pairings_approved_by_idx ON public.bridge_pairings (approved_by);

-- One row per MT5 account seen by any of the owner's PCs.
CREATE TABLE public.bridge_terminal_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  device_id uuid REFERENCES public.bridge_devices(id) ON DELETE SET NULL,
  server text NOT NULL CHECK (char_length(server) BETWEEN 1 AND 64),
  login text NOT NULL CHECK (login ~ '^\d{1,20}$'),
  company text CHECK (company IS NULL OR char_length(company) <= 120),
  trade_mode text NOT NULL CHECK (trade_mode IN ('demo', 'real', 'contest')),
  currency text CHECK (currency IS NULL OR currency ~ '^[A-Z]{3,5}$'),
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  matched_at timestamptz,
  ignored_at timestamptz,
  -- Set while the owner has not answered "is this a prop account?" on Home.
  needs_review boolean NOT NULL DEFAULT false,
  detected_zone text CHECK (detected_zone IS NULL OR char_length(detected_zone) BETWEEN 3 AND 64),
  week_offsets jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(week_offsets) = 'array' AND pg_column_size(week_offsets) <= 8192),
  server_offset_minutes integer CHECK (server_offset_minutes IS NULL OR server_offset_minutes BETWEEN -840 AND 840),
  offset_measured_at timestamptz,
  balance numeric,
  equity numeric,
  last_seen_at timestamptz,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bridge_terminal_accounts_identity UNIQUE (user_id, server, login)
);
CREATE INDEX bridge_terminal_accounts_account_id_idx ON public.bridge_terminal_accounts (account_id);
CREATE INDEX bridge_terminal_accounts_device_id_idx ON public.bridge_terminal_accounts (device_id);

-- Raw MT5 deals exactly as the terminal reports them; time_msc is the broker server wall clock (not UTC).
-- Idempotent: the Bridge re-sends overlapping windows, the primary key absorbs repeats.
CREATE TABLE public.bridge_deals (
  terminal_account_id uuid NOT NULL REFERENCES public.bridge_terminal_accounts(id) ON DELETE CASCADE,
  deal_ticket bigint NOT NULL CHECK (deal_ticket > 0),
  order_ticket bigint NOT NULL CHECK (order_ticket >= 0),
  position_id bigint NOT NULL CHECK (position_id >= 0),
  time_msc bigint NOT NULL,
  type smallint NOT NULL,
  entry smallint NOT NULL CHECK (entry BETWEEN 0 AND 3),
  symbol text NOT NULL CHECK (char_length(symbol) <= 40),
  volume numeric NOT NULL,
  price numeric NOT NULL,
  profit numeric NOT NULL DEFAULT 0,
  commission numeric NOT NULL DEFAULT 0,
  swap numeric NOT NULL DEFAULT 0,
  fee numeric NOT NULL DEFAULT 0,
  reason smallint NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (terminal_account_id, deal_ticket)
);
CREATE INDEX bridge_deals_position_idx ON public.bridge_deals (terminal_account_id, position_id);

-- Orders of positions: initial SL/TP live here, not on deals (§9.1).
CREATE TABLE public.bridge_orders (
  terminal_account_id uuid NOT NULL REFERENCES public.bridge_terminal_accounts(id) ON DELETE CASCADE,
  order_ticket bigint NOT NULL CHECK (order_ticket > 0),
  position_id bigint NOT NULL CHECK (position_id >= 0),
  time_setup_msc bigint NOT NULL,
  sl numeric NOT NULL DEFAULT 0,
  tp numeric NOT NULL DEFAULT 0,
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (terminal_account_id, order_ticket)
);
CREATE INDEX bridge_orders_position_idx ON public.bridge_orders (terminal_account_id, position_id);

-- Link MT5 position (segment key "<position_id>" or "<position_id>:2" after a reversal) → journal trade.
CREATE TABLE public.bridge_positions (
  terminal_account_id uuid NOT NULL REFERENCES public.bridge_terminal_accounts(id) ON DELETE CASCADE,
  position_key text NOT NULL CHECK (position_key ~ '^\d{1,20}(:\d{1,4})?$'),
  trade_id uuid REFERENCES public.journal_trades(id) ON DELETE SET NULL,
  synced_at timestamptz,
  PRIMARY KEY (terminal_account_id, position_key)
);
CREATE INDEX bridge_positions_trade_id_idx ON public.bridge_positions (trade_id);

-- Fixed-window counters for the public pairing endpoint and failed code confirmations.
CREATE TABLE public.bridge_rate_limits (
  key text PRIMARY KEY CHECK (char_length(key) BETWEEN 1 AND 120),
  window_start timestamptz NOT NULL,
  hits integer NOT NULL CHECK (hits >= 0)
);

-- Atomically counts one hit in a fixed window; true while the limit is not exceeded.
CREATE FUNCTION public.bridge_rate_limit_hit(p_key text, p_window_seconds integer, p_max integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hits integer;
BEGIN
  IF p_key IS NULL OR p_window_seconds <= 0 OR p_max <= 0 THEN
    RAISE EXCEPTION 'Invalid rate limit request' USING errcode = '22023';
  END IF;
  INSERT INTO public.bridge_rate_limits AS r (key, window_start, hits)
  VALUES (p_key, now(), 1)
  ON CONFLICT (key) DO UPDATE SET
    hits = CASE WHEN r.window_start <= now() - make_interval(secs => p_window_seconds) THEN 1 ELSE r.hits + 1 END,
    window_start = CASE WHEN r.window_start <= now() - make_interval(secs => p_window_seconds) THEN now() ELSE r.window_start END
  RETURNING hits INTO v_hits;
  RETURN v_hits <= p_max;
END;
$$;

-- Clears a counter (after a successful confirmation).
CREATE FUNCTION public.bridge_rate_limit_reset(p_key text)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$ DELETE FROM public.bridge_rate_limits WHERE key = p_key; $$;

ALTER TABLE public.bridge_pairings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bridge_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bridge_terminal_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bridge_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bridge_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bridge_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bridge_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bridge_pairings, public.bridge_devices, public.bridge_terminal_accounts, public.bridge_deals,
  public.bridge_orders, public.bridge_positions, public.bridge_rate_limits FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.bridge_rate_limit_hit(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bridge_rate_limit_reset(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bridge_rate_limit_hit(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.bridge_rate_limit_reset(text) TO service_role;
