-- supabase/migrations/002_catalog_tables.sql
-- Catalog reference data + per-user favorites.
-- Catalog rows are public-readable; favorites are scoped to auth.uid().

create extension if not exists "pgcrypto";

-- ──────────────────────────────────────────────────────────────────────────
-- clay_bodies
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.clay_bodies (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name            text not null,
  manufacturer    text,
  category        text not null check (category in ('stoneware','porcelain','earthenware','sculpture','other')),
  cone            text not null default '10',
  atmosphere      text not null default 'reduction' check (atmosphere in ('reduction','oxidation','either')),
  color_fired     text,
  hex_swatch      text,                 -- approximate UI hint, NOT a spec
  texture         text check (texture in ('smooth','fine grog','medium grog','heavy grog')),
  shrinkage_pct   numeric(4,1),
  absorption_pct  numeric(4,1),
  best_for        text[] not null default array[]::text[],
  notes           text,
  studios         text[] not null default array[]::text[],
  image_url       text,
  source_url      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists clay_bodies_category_idx on public.clay_bodies(category);
create index if not exists clay_bodies_name_idx on public.clay_bodies(name);

-- ──────────────────────────────────────────────────────────────────────────
-- glazes
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.glazes (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name            text not null,
  finish          text check (finish in ('glossy','satin','matte','textural','other')),
  family          text,                 -- 'celadon', 'shino', 'copper red', etc.
  base_color      text,
  hex_swatch      text,                 -- approximate UI hint, NOT a spec
  food_safe       boolean not null default true,
  layers_well     boolean,
  application     text,                 -- e.g. '2-3 sec dip', 'do not exceed 4 sec'
  reactive        boolean,              -- reactive to clay body iron content
  notes           text,
  cone            text not null default '10',
  atmosphere      text not null default 'reduction',
  studios         text[] not null default array[]::text[],
  source_url      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists glazes_finish_idx on public.glazes(finish);
create index if not exists glazes_family_idx on public.glazes(family);

-- ──────────────────────────────────────────────────────────────────────────
-- favorites (per-user join tables)
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.user_clay_favorites (
  user_id       uuid not null references auth.users(id) on delete cascade,
  clay_body_id  uuid not null references public.clay_bodies(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (user_id, clay_body_id)
);

create table if not exists public.user_glaze_favorites (
  user_id     uuid not null references auth.users(id) on delete cascade,
  glaze_id    uuid not null references public.glazes(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, glaze_id)
);

create index if not exists user_clay_favorites_user_idx  on public.user_clay_favorites(user_id);
create index if not exists user_glaze_favorites_user_idx on public.user_glaze_favorites(user_id);

-- ──────────────────────────────────────────────────────────────────────────
-- updated_at trigger
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clay_bodies_updated_at on public.clay_bodies;
create trigger clay_bodies_updated_at
  before update on public.clay_bodies
  for each row execute function public.set_updated_at();

drop trigger if exists glazes_updated_at on public.glazes;
create trigger glazes_updated_at
  before update on public.glazes
  for each row execute function public.set_updated_at();

-- ──────────────────────────────────────────────────────────────────────────
-- RLS
-- ──────────────────────────────────────────────────────────────────────────
alter table public.clay_bodies            enable row level security;
alter table public.glazes                 enable row level security;
alter table public.user_clay_favorites    enable row level security;
alter table public.user_glaze_favorites   enable row level security;

-- Catalog tables: anyone (incl. anon) can read.
drop policy if exists "clay_bodies public read" on public.clay_bodies;
create policy "clay_bodies public read"
  on public.clay_bodies for select
  using (true);

drop policy if exists "glazes public read" on public.glazes;
create policy "glazes public read"
  on public.glazes for select
  using (true);

-- Catalog mutations: service role only (no policy = denied for anon/authenticated).

-- Favorites: each user can only see/manage their own.
drop policy if exists "own clay favorites - select" on public.user_clay_favorites;
create policy "own clay favorites - select"
  on public.user_clay_favorites for select
  using (auth.uid() = user_id);

drop policy if exists "own clay favorites - insert" on public.user_clay_favorites;
create policy "own clay favorites - insert"
  on public.user_clay_favorites for insert
  with check (auth.uid() = user_id);

drop policy if exists "own clay favorites - delete" on public.user_clay_favorites;
create policy "own clay favorites - delete"
  on public.user_clay_favorites for delete
  using (auth.uid() = user_id);

drop policy if exists "own glaze favorites - select" on public.user_glaze_favorites;
create policy "own glaze favorites - select"
  on public.user_glaze_favorites for select
  using (auth.uid() = user_id);

drop policy if exists "own glaze favorites - insert" on public.user_glaze_favorites;
create policy "own glaze favorites - insert"
  on public.user_glaze_favorites for insert
  with check (auth.uid() = user_id);

drop policy if exists "own glaze favorites - delete" on public.user_glaze_favorites;
create policy "own glaze favorites - delete"
  on public.user_glaze_favorites for delete
  using (auth.uid() = user_id);
