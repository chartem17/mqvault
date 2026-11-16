-- Initial stop and the origin of the initial risk (ADR 0020).
-- Applied 2026-11-16 with the owner's approval, before the code that writes both columns was merged
-- (preview uses the production database). Version assigned by Supabase.
--
-- stop_loss stays what it was: the stop the journal shows (for MT5 imports — the last stop).
-- initial_stop_loss is the stop at entry; R and risk are measured from it, never from stop_loss.
-- risk_basis tells how risk_amount was obtained:
--   'stop'    — computed by the server from initial_stop_loss, volume and the value of a price move per lot;
--   'entered' — typed in the form or imported from a file;
--   'planned' — an estimate from the planned risk % (only set by the backfill, with the owner's consent).
-- Existing rows are not changed here; see docs/runbooks/trade-risk-backfill.md.

alter table public.journal_trades
  add column if not exists initial_stop_loss numeric(18, 8),
  add column if not exists risk_basis text;

alter table public.journal_trades
  drop constraint if exists journal_trades_risk_basis_check;
alter table public.journal_trades
  add constraint journal_trades_risk_basis_check
  check (risk_basis is null or risk_basis in ('stop', 'entered', 'planned'));

comment on column public.journal_trades.initial_stop_loss is
  'Stop at entry (MT5: stop of the opening order). R and risk_amount are measured from it (ADR 0020).';
comment on column public.journal_trades.risk_basis is
  'Origin of risk_amount: stop (server, from initial_stop_loss), entered (typed/imported), planned (estimate, backfill).';
