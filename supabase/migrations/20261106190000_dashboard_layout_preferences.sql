-- Per-user arrangement of the Overview widgets (positions, sizes, mobile order).
-- Same access model as journal_layout_preferences: RLS on, no client policies;
-- the server reads and writes through the private owner (service key).
CREATE TABLE public.dashboard_layout_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.app_users(id) ON DELETE CASCADE,
  layout jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dashboard_layout_preferences_layout_object CHECK (jsonb_typeof(layout) = 'object' AND pg_column_size(layout) <= 8192)
);
ALTER TABLE public.dashboard_layout_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dashboard_layout_preferences FROM anon, authenticated;
