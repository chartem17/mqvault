-- Additive settings only. No historical balances, user records or existing financial fields are rewritten.
ALTER TABLE public.accounts
  ADD COLUMN prop_target_state text,
  ADD COLUMN prop_max_loss_state text,
  ADD COLUMN prop_daily_loss_state text,
  ADD COLUMN prop_min_days_state text,
  ADD COLUMN prop_max_loss_mode text,
  ADD COLUMN prop_day_timezone text,
  ADD COLUMN prop_day_close time(0) without time zone,
  ADD COLUMN prop_loss_control_basis text,
  ADD COLUMN prop_rules_notes text,
  ADD COLUMN prop_rules_revision integer NOT NULL DEFAULT 0,
  ADD CONSTRAINT accounts_prop_target_state_check CHECK (prop_target_state IS NULL OR prop_target_state IN ('unknown','not_applicable','configured')),
  ADD CONSTRAINT accounts_prop_max_loss_state_check CHECK (prop_max_loss_state IS NULL OR prop_max_loss_state IN ('unknown','not_applicable','configured')),
  ADD CONSTRAINT accounts_prop_daily_loss_state_check CHECK (prop_daily_loss_state IS NULL OR prop_daily_loss_state IN ('unknown','not_applicable','configured')),
  ADD CONSTRAINT accounts_prop_min_days_state_check CHECK (prop_min_days_state IS NULL OR prop_min_days_state IN ('unknown','not_applicable','configured')),
  ADD CONSTRAINT accounts_prop_max_loss_mode_check CHECK (prop_max_loss_mode IS NULL OR prop_max_loss_mode IN ('static','eod_trailing_percent')),
  ADD CONSTRAINT accounts_prop_timezone_length_check CHECK (prop_day_timezone IS NULL OR char_length(prop_day_timezone) BETWEEN 3 AND 64),
  ADD CONSTRAINT accounts_prop_day_close_check CHECK (prop_day_close IS NULL OR (prop_day_close < time '24:00:00' AND extract(second FROM prop_day_close) = 0)),
  ADD CONSTRAINT accounts_prop_control_basis_check CHECK (prop_loss_control_basis IS NULL OR prop_loss_control_basis IN ('balance','equity')),
  ADD CONSTRAINT accounts_prop_rules_notes_check CHECK (prop_rules_notes IS NULL OR char_length(prop_rules_notes) <= 2000),
  ADD CONSTRAINT accounts_prop_rules_revision_check CHECK (prop_rules_revision >= 0),
  ADD CONSTRAINT accounts_prop_target_value_check CHECK (prop_target_state IS DISTINCT FROM 'configured' OR (target_percent IS NOT NULL AND target_percent > 0 AND target_percent <= 100)),
  ADD CONSTRAINT accounts_prop_max_loss_value_check CHECK (prop_max_loss_state IS DISTINCT FROM 'configured' OR (max_loss_percent IS NOT NULL AND max_loss_percent > 0 AND max_loss_percent <= 100)),
  ADD CONSTRAINT accounts_prop_daily_loss_value_check CHECK (prop_daily_loss_state IS DISTINCT FROM 'configured' OR (daily_loss_percent IS NOT NULL AND daily_loss_percent > 0 AND daily_loss_percent <= 100)),
  ADD CONSTRAINT accounts_prop_min_days_value_check CHECK (prop_min_days_state IS DISTINCT FROM 'configured' OR (min_trading_days IS NOT NULL AND min_trading_days >= 0));

CREATE FUNCTION public.bump_prop_rules_revision() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF NEW.prop_rules_revision IS DISTINCT FROM OLD.prop_rules_revision THEN
    RAISE EXCEPTION 'prop_rules_revision is server managed';
  END IF;
  IF ROW(NEW.account_type, NEW.initial_balance, NEW.phase, NEW.target_percent, NEW.max_loss_percent, NEW.daily_loss_percent, NEW.min_trading_days, NEW.broker_timezone, NEW.prop_target_state, NEW.prop_max_loss_state, NEW.prop_daily_loss_state, NEW.prop_min_days_state, NEW.prop_max_loss_mode, NEW.prop_day_timezone, NEW.prop_day_close, NEW.prop_loss_control_basis, NEW.prop_rules_notes)
     IS DISTINCT FROM
     ROW(OLD.account_type, OLD.initial_balance, OLD.phase, OLD.target_percent, OLD.max_loss_percent, OLD.daily_loss_percent, OLD.min_trading_days, OLD.broker_timezone, OLD.prop_target_state, OLD.prop_max_loss_state, OLD.prop_daily_loss_state, OLD.prop_min_days_state, OLD.prop_max_loss_mode, OLD.prop_day_timezone, OLD.prop_day_close, OLD.prop_loss_control_basis, OLD.prop_rules_notes) THEN
    NEW.prop_rules_revision := OLD.prop_rules_revision + 1;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.bump_prop_rules_revision() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_prop_rules_revision() TO service_role;
CREATE TRIGGER accounts_prop_rules_revision BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.bump_prop_rules_revision();
COMMENT ON COLUMN public.accounts.prop_max_loss_mode IS 'eod_trailing_percent: percentage of the maximum finalized EOD balance, not a percentage of initial capital. Not an automatic account verdict.';
COMMENT ON COLUMN public.accounts.prop_target_state IS 'NULL preserves legacy interpretation: a value is configured; an absent value is unknown, never automatically not_applicable.';
COMMENT ON COLUMN public.accounts.prop_rules_revision IS 'Optimistic rule-edit revision. The API must compare the expected revision; this trigger alone does not enforce a client comparison.';
