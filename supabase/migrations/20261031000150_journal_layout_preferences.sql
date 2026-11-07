CREATE TABLE public.journal_layout_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.app_users(id) ON DELETE CASCADE,
  layout jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT journal_layout_preferences_layout_object CHECK (jsonb_typeof(layout) = 'object' AND pg_column_size(layout) <= 4096)
);
ALTER TABLE public.journal_layout_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.journal_layout_preferences FROM anon, authenticated;
