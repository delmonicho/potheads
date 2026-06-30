-- supabase/migrations/004_portfolios.sql
-- Public, no-auth shareable portfolios (Phase 1).
--
-- A signed-in user curates a subset of their pieces into a public "portfolio"
-- at /p/{slug}. Privacy is enforced in RLS, not just the UI: anonymous (and any
-- non-owner) requests can read ONLY published portfolios, their showcased items,
-- and the photos of those showcased pieces. Everything else — private pieces,
-- tags, stage events, favorites, custom glazes — stays invisible to anon.
--
-- All curated label data (title, form, clay body, glazes, status, …) lives
-- DENORMALIZED on portfolio_items so the public read path never touches the
-- private `pieces` / `tags` tables. The only private table exposed to anon is
-- `photos`, and only for showcased pieces of a published portfolio.

create table if not exists public.portfolios (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  slug            text not null unique,
  title           text,                 -- portfolio / studio display name
  statement       text,                 -- short artist statement
  studio_identity text,                 -- studio name / location line
  layout          text not null default 'editorial'
                    check (layout in ('editorial','masonry')),
  published       boolean not null default false,
  preview_token   uuid not null default gen_random_uuid(),  -- anon draft link (Phase 4)
  view_count      integer not null default 0,               -- owner-visible counter (Phase 4)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists portfolios_user_idx on public.portfolios(user_id);

create table if not exists public.portfolio_items (
  id            uuid primary key default gen_random_uuid(),
  portfolio_id  uuid not null references public.portfolios(id) on delete cascade,
  piece_id      uuid not null references public.pieces(id) on delete cascade,
  showcased     boolean not null default true,
  position      integer not null default 0,
  -- curated, denormalized presentation overrides (snapshotted from the piece):
  title         text,
  year          text,
  form          text,
  clay_body     text,
  glazes        jsonb,                  -- [{ name, hex }] snapshot incl. custom-glaze hex
  firing        text,
  dimensions    text,
  status        text check (status in ('available','sold','nfs')),
  show_process  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (portfolio_id, piece_id)
);

create index if not exists portfolio_items_portfolio_idx on public.portfolio_items(portfolio_id);
create index if not exists portfolio_items_piece_idx on public.portfolio_items(piece_id);

-- Reuse the shared updated_at trigger helper defined in migration 002.
drop trigger if exists portfolios_updated_at on public.portfolios;
create trigger portfolios_updated_at before update on public.portfolios
  for each row execute function public.set_updated_at();

drop trigger if exists portfolio_items_updated_at on public.portfolio_items;
create trigger portfolio_items_updated_at before update on public.portfolio_items
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.portfolios enable row level security;
alter table public.portfolio_items enable row level security;

-- Owner: full control over their own portfolios (authenticated).
drop policy if exists "portfolios owner all" on public.portfolios;
create policy "portfolios owner all" on public.portfolios
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "portfolio_items owner all" on public.portfolio_items;
create policy "portfolio_items owner all" on public.portfolio_items
  for all to authenticated
  using (exists (
    select 1 from public.portfolios p
    where p.id = portfolio_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.portfolios p
    where p.id = portfolio_id and p.user_id = auth.uid()
  ));

-- Public read: ONLY published portfolios. Granted to anon AND authenticated so a
-- signed-in visitor viewing someone else's portfolio sees it too (the owner
-- "all" policy above still covers their own drafts).
drop policy if exists "portfolios public read published" on public.portfolios;
create policy "portfolios public read published" on public.portfolios
  for select to anon, authenticated
  using (published = true);

-- Public read: ONLY showcased items of a published portfolio.
drop policy if exists "portfolio_items public read published" on public.portfolio_items;
create policy "portfolio_items public read published" on public.portfolio_items
  for select to anon, authenticated
  using (
    showcased = true
    and exists (
      select 1 from public.portfolios p
      where p.id = portfolio_id and p.published = true
    )
  );

-- Public read of `photos` rows: ONLY for showcased pieces in a published
-- portfolio. Additive — the existing owner-scoped photos policy is unchanged, so
-- this cannot widen access to a user's private (non-showcased) pieces.
drop policy if exists "photos public read showcased" on public.photos;
create policy "photos public read showcased" on public.photos
  for select to anon, authenticated
  using (exists (
    select 1
    from public.portfolio_items pi
    join public.portfolios p on p.id = pi.portfolio_id
    where pi.piece_id = photos.piece_id
      and pi.showcased = true
      and p.published = true
  ));

-- Public read of the storage objects themselves. Path is
-- {user_id}/{piece_id}/{file}, so the piece id is split_part(name,'/',2).
-- Lets the anon client call createSignedUrls for exactly those files.
drop policy if exists "storage public read showcased photos" on storage.objects;
create policy "storage public read showcased photos" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'photos'
    and exists (
      select 1
      from public.portfolio_items pi
      join public.portfolios p on p.id = pi.portfolio_id
      where pi.showcased = true
        and p.published = true
        and pi.piece_id::text = split_part(objects.name, '/', 2)
    )
  );
