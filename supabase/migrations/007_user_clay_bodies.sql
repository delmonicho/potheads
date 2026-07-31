-- Allow users to add their own custom clay bodies (mirrors 003_user_glazes.sql).
-- Seed rows keep user_id = null (global). User rows are owned + editable by their creator.

ALTER TABLE public.clay_bodies
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Give category/atmosphere sensible defaults so users only need to supply a name.
ALTER TABLE public.clay_bodies
  ALTER COLUMN category SET DEFAULT 'other',
  ALTER COLUMN atmosphere SET DEFAULT 'either';

CREATE INDEX IF NOT EXISTS clay_bodies_user_idx ON public.clay_bodies(user_id);

-- Users can insert their own rows.
DROP POLICY IF EXISTS "own clay bodies - insert" ON public.clay_bodies;
CREATE POLICY "own clay bodies - insert"
  ON public.clay_bodies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update/delete only their own rows.
DROP POLICY IF EXISTS "own clay bodies - update" ON public.clay_bodies;
CREATE POLICY "own clay bodies - update"
  ON public.clay_bodies FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own clay bodies - delete" ON public.clay_bodies;
CREATE POLICY "own clay bodies - delete"
  ON public.clay_bodies FOR DELETE
  USING (auth.uid() = user_id);

-- The existing "clay_bodies public read" policy (using true) already covers
-- global + user rows for all authenticated and anon readers — no change needed.
