-- supabase/migrations/003_user_glazes.sql
-- User-scoped custom glazes.
-- Seed/reference glazes have user_id = null (global, public-readable).
-- Custom glazes created in-app are owned by the user that made them, and are
-- visible/editable only to that user. This keeps the app private-by-default
-- while letting users extend the glaze catalog with their own entries.

alter table public.glazes
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists glazes_user_idx on public.glazes(user_id);

-- Read: everyone (incl. anon) sees the global seed catalog (user_id is null);
-- authenticated users additionally see their own custom glazes.
drop policy if exists "glazes public read" on public.glazes;
drop policy if exists "glazes read global + own" on public.glazes;
create policy "glazes read global + own"
  on public.glazes for select
  using (user_id is null or auth.uid() = user_id);

-- Write: users may create / edit / delete only their own custom glazes.
-- Global seed rows (user_id null) remain service-role only.
drop policy if exists "glazes insert own" on public.glazes;
create policy "glazes insert own"
  on public.glazes for insert
  with check (auth.uid() = user_id);

drop policy if exists "glazes update own" on public.glazes;
create policy "glazes update own"
  on public.glazes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "glazes delete own" on public.glazes;
create policy "glazes delete own"
  on public.glazes for delete
  using (auth.uid() = user_id);
