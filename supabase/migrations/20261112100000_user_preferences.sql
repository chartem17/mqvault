-- Per-user settings (start page, privacy mode, formats, defaults, monthly goals, today's checklist).
-- Additive: one column with a default; no existing value changes. Shape is validated by the server
-- (src/lib/preferences/user-preferences.ts); the database only bounds the type and size.
ALTER TABLE public.app_users
  ADD COLUMN preferences jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.app_users
  ADD CONSTRAINT app_users_preferences_shape CHECK (jsonb_typeof(preferences) = 'object' AND octet_length(preferences::text) <= 16384);
