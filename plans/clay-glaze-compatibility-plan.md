# Clay × Glaze Compatibility — Future Improvement Plan

**Status:** planned (after catalog v1 ships)
**Depends on:** `clay_bodies` and `glazes` tables seeded (see `add-catalogs-prompt.md`)
**Why this matters:** the value of Potheads compounds when material decisions become navigable knowledge. A glaze on a porcelain body and the same glaze on Rod's Bod are essentially different glazes — the catalog without compatibility is a dictionary; with compatibility it's a field guide.

---

## The thesis

The studio's own glaze descriptions are already saturated with clay-specific observations:

> "Cornwall Stone is reactive to the amount of iron in the clay — for instance, warm yellow brown with deep speckles coming through from Rod's Bod. Likely whiter and cooler on more porcelain or white clays."
>
> "Black Walnut can be a taupey color on light clays, show off warmer tones and speckling with Rod's Bod, and be almost monochromatic with the clays like Dark Brown."
>
> "Banilla also contains iron, so it can react to the base clay. Depending on the glaze/clay fit it can texturally go glossy, particularly on higher shrink clays like porcelain. Over clays that contain iron, like Rod's Bod, Fat Red, etc it may look more brown."

That's editorial-quality compatibility data sitting in prose form. Phase 1 of this feature is just structuring what TPS already published. Phase 2 opens it up to user-contributed observations and photos.

---

## Schema

Add a third migration: `supabase/migrations/003_clay_glaze_compatibility.sql`

```sql
-- Editorial pairings: studio-authored or curator-added notes
create table public.clay_glaze_pairings (
  id              uuid primary key default gen_random_uuid(),
  clay_body_id    uuid not null references public.clay_bodies(id) on delete cascade,
  glaze_id        uuid not null references public.glazes(id) on delete cascade,
  effect          text not null,            -- short label e.g. "warm yellow brown with speckles"
  description     text,                     -- prose detail
  source          text not null default 'editorial' check (source in ('editorial','studio','community')),
  rating          smallint check (rating between 1 and 5),  -- nullable; not all pairings are ratings
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (clay_body_id, glaze_id, source)
);

-- User-contributed observations (separate from editorial — preserves provenance)
create table public.user_pairing_notes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  clay_body_id    uuid not null references public.clay_bodies(id) on delete cascade,
  glaze_id        uuid not null references public.glazes(id) on delete cascade,
  rating          smallint check (rating between 1 and 5),
  notes           text,
  photo_path      text,                     -- Storage path; null if no photo
  application     text,                     -- "3 sec dip", "thin", etc.
  fire_date       date,                     -- approximate firing date for context
  is_public       boolean not null default false,  -- private by default
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index user_pairing_notes_user_idx on public.user_pairing_notes(user_id);
create index user_pairing_notes_clay_idx on public.user_pairing_notes(clay_body_id);
create index user_pairing_notes_glaze_idx on public.user_pairing_notes(glaze_id);
create index clay_glaze_pairings_clay_idx on public.clay_glaze_pairings(clay_body_id);
create index clay_glaze_pairings_glaze_idx on public.clay_glaze_pairings(glaze_id);

-- RLS
alter table public.clay_glaze_pairings  enable row level security;
alter table public.user_pairing_notes   enable row level security;

create policy "pairings public read"
  on public.clay_glaze_pairings for select using (true);

create policy "own notes - all"
  on public.user_pairing_notes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "public notes - read"
  on public.user_pairing_notes for select
  using (is_public = true);

-- updated_at triggers (set_updated_at function already exists from migration 002)
create trigger clay_glaze_pairings_updated_at
  before update on public.clay_glaze_pairings
  for each row execute function public.set_updated_at();

create trigger user_pairing_notes_updated_at
  before update on public.user_pairing_notes
  for each row execute function public.set_updated_at();
```

### Why split editorial from user notes

Editorial pairings are slow-moving canonical knowledge — the studio's documented behavior. User notes are personal, varied, and noisier. Mixing them in one table makes querying harder ("show me all editorial entries for this glaze" vs "show me my notes on this glaze") and complicates moderation later. Two tables, one canonical, one user-scoped.

A `is_public` flag on user notes opens the door to a community feed without forcing it — default-private is the right default for a journal-adjacent tool.

---

## Editorial seed (extracted from TPS glaze range page)

A starter set of pairings to seed. These are quoted/paraphrased directly from the studio's published glaze descriptions — high-confidence canonical pairings:

| Glaze | Clay Body | Effect |
|---|---|---|
| Cornwall Stone | Rod's Bod | warm yellow-brown with deep speckles |
| Cornwall Stone | (any porcelain) | whiter and cooler |
| Black Walnut | (light clays) | taupey |
| Black Walnut | Rod's Bod | warmer tones with speckling |
| Black Walnut | Dark Brown | nearly monochromatic |
| Banilla | Rod's Bod | more brown |
| Banilla | Fat Red | more brown |
| Banilla | (porcelain) | more glossy |
| Bringle Yellow | (iron-rich clays) | granny-smith green |
| Bringle Yellow | (white stoneware) | optic yellow |
| Bringle Yellow | (porcelain) | optic yellow |
| Tangerine | (porcelain) | brighter |
| Tangerine | (darker stonewares) | earthier |
| Lavender | (paler clays) | more purple |
| Pete's Cranberry | (any) | classic copper red in good reduction |
| Mottled Blue Cream | (any) | beware: runs if applied across whole piece |

Note that several of these are clay-category pairings (e.g., "any porcelain") rather than specific clay bodies. The schema as designed requires specific `clay_body_id` rows. Two options:

1. **Expand each category pairing** to all matching clays (Cornwall Stone × Babu, Cornwall Stone × Nara, Cornwall Stone × Coleman, etc.) — denormalized but queryable.
2. **Add a `clay_category_pairings` sibling table** for category-level rules — normalized but adds a query path.

Recommend option 1 for v1: simple, queryable, the duplication isn't painful at this scale (~100 editorial rows max).

A seed file `supabase/seed/clay_glaze_pairings.json` would encode these once the schema lands.

---

## UX

Three navigation paths into the same data:

### From a clay body detail page
> **Glazes documented on this clay** (5)
> Cornwall Stone — warm yellow-brown with speckles
> Black Walnut — warmer tones, speckling
> ...
>
> **Your notes on this clay** (2)
> [pairing photo] Tangerine on LBM, Apr 2026 — "brighter than I expected, ⭐⭐⭐⭐"

### From a glaze detail page
> **Clay bodies this glaze is documented on** (8)
> Rod's Bod — warm yellow-brown with speckles
> Babu Porcelain — whiter and cooler
> ...
>
> **Community notes** (12)
> [filter: most-rated | most-recent | most-photos]

### From a piece detail page
The piece already has `clay_body_id` and `glaze_ids[]`. Clicking the combination opens a side panel with:
- Editorial guidance for that exact pair (if exists)
- Your prior notes for the same pair
- Quick-add: "Was this what you expected? Rate this firing."

This is the loop that makes the catalog stick — every firing becomes a structured data point against canonical materials.

---

## Phasing

- **v1 (when this lands):** schema + editorial seed + read-only display on clay/glaze detail pages.
- **v2:** authenticated user notes (private only); add-note form on detail pages.
- **v3:** photo uploads to Storage; bind notes to piece records.
- **v4:** opt-in public notes; community feed; light moderation.
- **v5:** filtering catalog grids by "has notes for my favorite clay" — turning the catalog into a shopping/exploration tool.

Each phase ships independently. The schema is forward-compatible with all of them.

---

## Risks & decisions to make later

- **Photo storage costs.** A community feed with photos at scale is the most expensive piece. Mitigate: image compression on upload; cap photo size; only public-ified notes index into a separate denormalized feed table to keep query costs predictable.
- **Moderation.** Public notes need at minimum a report/hide path before launch. Don't ship public notes without it.
- **Conflicting editorial rows.** If two editorial entries disagree (e.g., studio updates a description), unique constraint on `(clay, glaze, source)` means an upsert collision. Decide: latest-wins, or version history. Probably latest-wins for v1 with a `previous_description` text column added later if needed.
- **The category-pairing question above.** Option 1 (denormalized) wins for now but revisit if editorial pairings grow past ~500 rows.

---

## Out of scope for this plan

- Glaze-on-glaze layering (e.g., Mottled Blue Cream over Pete's Cranberry). That's a different many-to-many — `glaze_layering` — and worth its own table when the user actually wants to track it. The catalog already encodes some of this in glaze `notes` strings.
- Atmospheric variation tracking (kiln position, reduction strength). Real but probably belongs on the piece-firing record, not the pairing record.
- Cross-studio pairings (a glaze that exists at multiple TPS locations might fire differently in each kiln). Defer until multi-studio support exists.
