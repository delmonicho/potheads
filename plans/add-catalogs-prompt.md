# Add Clay & Glaze Catalogs to Potheads

Build two browsable reference catalogs (clay bodies + glazes) plus per-user favorites, sourced from The Pottery Studio Brooklyn 9th St. The app currently has neither a clay catalog UI nor a glaze catalog UI — this introduces both.

## Context

- Stack: Vite + React 19 + Tailwind v4 + Supabase + Vercel
- Repo: `delmonicho/potheads`, deployed at `pot-heads.studio`
- Studio: TPS 9th St (Gowanus), cone 10 reduction
- Existing planning doc: `POTHEADS_CATALOG_PLAN.md` — supersede with this prompt where they conflict
- Five Supabase tables already exist with RLS; this adds four more
- Auth: Google OAuth via Supabase already configured
- Design tokens (already in use): primary brown `#78350f`, sage green `#4a7c59`, earthy/warm palette

## Sources of truth

- Clay bodies: <https://thepotterystudio.com/collections/brooklyn-gowanus-clay-and-tool-ordering> (28 entries provided in seed)
- Glazes: <https://thepotterystudio.com/pages/our-glaze-range> (27 entries provided in seed — 25 from the public range page plus Malcolm Davis Shino and Ohata Red, retained from the prior catalog plan)

The studio's public page currently lists 25 glazes. Malcolm Davis Shino and Ohata Red are kept in the catalog because they're in active studio use; they're simply not on the published page. Confirm with studio staff if seasonality matters.

## Goals

1. Browsable, filterable catalogs for clay bodies and glazes
2. Per-user favorites with optimistic toggle
3. Detail views with the studio's tasting-notes (e.g., Pete's Cranberry behavior, Mottled Blue Cream warnings)
4. Foundation for later features: clay × glaze compatibility notes, piece-to-catalog linking

## Out of scope (do not build)

- Editing catalog rows from the UI (admin-only, service role)
- Clay × glaze compatibility join (later phase)
- Studio location switcher (later phase — schema supports it via `studios text[]`)
- Image generation/upload (use studio's CDN URLs in seed)

---

## Step 1 — Database

Add migration file: `supabase/migrations/002_catalog_tables.sql`

Use the SQL in the accompanying `002_catalog_tables.sql` artifact verbatim. It creates:

- `public.clay_bodies` — reference, public-readable
- `public.glazes` — reference, public-readable
- `public.user_clay_favorites` — composite PK `(user_id, clay_body_id)`, RLS scoped to `auth.uid()`
- `public.user_glaze_favorites` — composite PK `(user_id, glaze_id)`, RLS scoped to `auth.uid()`
- Trigger `set_updated_at()` on both catalog tables
- RLS policies: catalog SELECT open to everyone; mutations service-role only; favorites locked to owning user

After applying, regenerate types:

```bash
supabase gen types typescript --project-id <id> > src/lib/database.types.ts
```

## Step 2 — Seed

Add: `supabase/seed/clay_bodies.json` and `supabase/seed/glazes.json` (use the provided JSON artifacts).

Add a Node seed script at `scripts/seed-catalog.ts` that:

1. Reads both JSON files
2. Uses the **service role key** (loaded from `.env.local` as `SUPABASE_SERVICE_ROLE_KEY`, NEVER committed)
3. Upserts on `slug` (idempotent — safe to re-run when studio updates the range)
4. Logs counts and any failures

```ts
// scripts/seed-catalog.ts (sketch)
import { createClient } from '@supabase/supabase-js';
import clayBodies from '../supabase/seed/clay_bodies.json';
import glazes from '../supabase/seed/glazes.json';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function seed() {
  const { error: clayErr, count: clayCount } = await supabase
    .from('clay_bodies')
    .upsert(clayBodies, { onConflict: 'slug', count: 'exact' });
  if (clayErr) throw clayErr;

  const { error: glazeErr, count: glazeCount } = await supabase
    .from('glazes')
    .upsert(glazes, { onConflict: 'slug', count: 'exact' });
  if (glazeErr) throw glazeErr;

  console.log(`Seeded ${clayCount} clay bodies, ${glazeCount} glazes`);
}

seed().catch((e) => { console.error(e); process.exit(1); });
```

Add an npm script: `"seed:catalog": "tsx scripts/seed-catalog.ts"`

## Step 3 — Data layer

Create `src/lib/catalog/queries.ts`:

```ts
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

export type ClayBody = Database['public']['Tables']['clay_bodies']['Row'];
export type Glaze    = Database['public']['Tables']['glazes']['Row'];

export async function listClayBodies() {
  const { data, error } = await supabase
    .from('clay_bodies')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return data;
}

export async function listGlazes() {
  const { data, error } = await supabase
    .from('glazes')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return data;
}

export async function listClayFavorites(userId: string) {
  const { data, error } = await supabase
    .from('user_clay_favorites')
    .select('clay_body_id')
    .eq('user_id', userId);
  if (error) throw error;
  return new Set(data.map((r) => r.clay_body_id));
}

export async function listGlazeFavorites(userId: string) {
  const { data, error } = await supabase
    .from('user_glaze_favorites')
    .select('glaze_id')
    .eq('user_id', userId);
  if (error) throw error;
  return new Set(data.map((r) => r.glaze_id));
}

export async function toggleClayFavorite(userId: string, clayBodyId: string, on: boolean) {
  if (on) {
    const { error } = await supabase
      .from('user_clay_favorites')
      .insert({ user_id: userId, clay_body_id: clayBodyId });
    if (error && error.code !== '23505') throw error; // ignore dup
  } else {
    const { error } = await supabase
      .from('user_clay_favorites')
      .delete()
      .match({ user_id: userId, clay_body_id: clayBodyId });
    if (error) throw error;
  }
}

export async function toggleGlazeFavorite(userId: string, glazeId: string, on: boolean) {
  if (on) {
    const { error } = await supabase
      .from('user_glaze_favorites')
      .insert({ user_id: userId, glaze_id: glazeId });
    if (error && error.code !== '23505') throw error;
  } else {
    const { error } = await supabase
      .from('user_glaze_favorites')
      .delete()
      .match({ user_id: userId, glaze_id: glazeId });
    if (error) throw error;
  }
}
```

Create matching React Query (or SWR — match whatever the rest of the app uses) hooks at `src/lib/catalog/hooks.ts` for `useClayBodies`, `useGlazes`, `useClayFavorites`, `useGlazeFavorites`, with optimistic updates on the toggle mutations.

## Step 4 — Components

Match the existing app's component style and earthy palette. Build these:

### `src/components/catalog/CatalogShell.tsx`

Shared shell with:
- Tab switcher: **Clay** / **Glazes**
- Search input (filters on `name` + `notes` client-side, since corpus is small)
- Filter chips:
  - Clay tab: category (stoneware/porcelain/earthenware/sculpture), texture, "favorites only"
  - Glaze tab: finish (glossy/satin/matte/textural), family, food-safe, "favorites only"
- Grid container

### `src/components/catalog/ClayCard.tsx`

- Color swatch derived from `hex_swatch` (with a subtle "approximate" tooltip on hover)
- Name + manufacturer (e.g., "Standard Ceramic")
- Texture + category pills
- Heart toggle (top-right)
- Click → opens `ClayDetail` modal/drawer

### `src/components/catalog/GlazeCard.tsx`

- Color swatch from `hex_swatch`
- Name + finish pill (glossy/satin/matte/textural)
- Family in muted text
- Heart toggle
- Click → opens `GlazeDetail`

### `src/components/catalog/ClayDetail.tsx`

Show all available fields:
- Hero swatch + name + manufacturer
- Color when fired, texture, category
- Shrinkage % and absorption % (hide if null)
- Cone + atmosphere
- "Best for" chips
- Notes (full text, prose)
- Source link → `source_url`
- Image (if `image_url` set)
- Favorite button (large, with state)

### `src/components/catalog/GlazeDetail.tsx`

- Hero swatch + name + finish
- Family
- Food safe indicator
- Layering hint
- Application notes (e.g., "2-3 sec dip", "no more than 4 sec")
- Reactive flag with explanation
- Notes (full text — the studio's tasting-notes are the most valuable content)
- Source link
- Favorite button

### Color swatch caveat

Render an info icon next to every `hex_swatch` that opens a tooltip:
> "Approximate fired color. Actual results vary with glaze, atmosphere, kiln load, and thickness."

This is a real concern for ceramics and we don't want users mistaking the swatch for a spec.

## Step 5 — Routes

Add routes (matching existing router setup):

- `/catalog` → redirects to `/catalog/clay`
- `/catalog/clay` → `<CatalogShell tab="clay">` rendering `<ClayCard>` grid
- `/catalog/glazes` → `<CatalogShell tab="glazes">` rendering `<GlazeCard>` grid

Add a "Catalog" link to the existing nav.

## Step 6 — Empty / loading / error states

- Loading: skeleton cards (match the existing app's skeleton pattern if one exists)
- Empty (filtered to no results): "No clay bodies match your filters" + Clear filters button
- Empty (favorites tab, no faves yet): friendly nudge — "Tap the heart on any clay/glaze to save it here"
- Error: surface a toast and render an inline retry; never blank-page the catalog

## Step 7 — Acceptance criteria

- [ ] Migration applies cleanly to a fresh Supabase project; rolling back drops only the four new tables
- [ ] `npm run seed:catalog` produces 28 clay bodies and 27 glazes; second run is a no-op
- [ ] Anonymous users can browse `/catalog/clay` and `/catalog/glazes` and see all entries
- [ ] Anonymous users do NOT see a heart icon (or it prompts sign-in)
- [ ] Authenticated users can favorite/unfavorite from grid and detail views; state survives refresh
- [ ] One user's favorites are not visible to another user (verified by manually inspecting RLS in SQL editor)
- [ ] Search filters clay/glaze grid by name + notes substring
- [ ] Filter chips compose (e.g., porcelain + favorites-only narrows correctly)
- [ ] Detail view links out to the studio's source URL in a new tab
- [ ] All hex swatches render; missing fields hide gracefully (no "null" or empty rows in detail)
- [ ] PWA still installable; Lighthouse score not regressed

## Style notes

- Stick to the existing earthy palette: brown `#78350f`, sage `#4a7c59`, plus warm neutrals
- Heart icon: outlined when off, filled brown when on
- Card corners: match existing radius (likely `rounded-xl` or `rounded-2xl`)
- Use Tailwind v4 native CSS variables — don't introduce new design tokens unless required
- Mobile-first; the catalog is most useful in the studio on a phone

## Notes for future work (do not build now)

- **Clay × glaze compatibility table** — see the dedicated roadmap doc `clay-glaze-compatibility-plan.md`. This is the highest-value next phase: the studio's own glaze descriptions already reference specific clay pairings, giving us a strong editorial seed before opening it up to user-contributed notes.
- **Piece linking** — when creating/editing a piece, allow selecting a clay body and one or more glazes from the catalog. This is the real payoff: per-piece firing histories tied to canonical materials.
- **Studio scoping** — `studios text[]` is in place. When TPS Norman Ave or Chelsea ranges are added, no schema change required — just additional seed entries with overlapping slugs OR distinct slugs per studio (decide on convention before second studio).
- **Manufacturer enrichment** — many TPS clays are studio-internal labels with `manufacturer = null`. A follow-up pass via Shopify's `/products/{handle}.json` endpoint can fill in product descriptions and prices programmatically (Shopify exposes this publicly).
- **`hex_swatch` refinement** — the seeded swatches are eyeballed approximations from color descriptions. Replace by sampling actual fired test tiles when possible.

## Files this prompt produces

```
supabase/
  migrations/
    002_catalog_tables.sql
  seed/
    clay_bodies.json
    glazes.json
scripts/
  seed-catalog.ts
src/
  lib/
    catalog/
      queries.ts
      hooks.ts
  components/
    catalog/
      CatalogShell.tsx
      ClayCard.tsx
      ClayDetail.tsx
      GlazeCard.tsx
      GlazeDetail.tsx
  routes/  (or pages/, match existing convention)
    catalog/
      index.tsx
      clay.tsx
      glazes.tsx
```
