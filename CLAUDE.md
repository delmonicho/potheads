# Potheads — Pottery Tracker PWA

## Project Overview
A mobile-first PWA for tracking pottery pieces through production stages.
Built for iPhone (add to home screen). Private by default — each user sees only their own pieces.

## Tech Stack
- Vite 8 + React 19
- Tailwind CSS v4 (@tailwindcss/vite)
- Supabase (auth, postgres, storage)
- vite-plugin-pwa (installed with --legacy-peer-deps, .npmrc configured)
- browser-image-compression

## Infrastructure Decisions
- `vite-plugin-pwa` installed with `--legacy-peer-deps`; `.npmrc` contains `legacy-peer-deps=true` — required for Vercel builds
- `vercel.json` contains the `/auth/callback` → Supabase rewrite rule (see Auth & Routing)
- PWA icons at `public/icon-192.png` and `public/icon-512.png`
- Deployed at: `https://pot-heads.studio`

## Supabase
- Project URL in VITE_SUPABASE_URL
- Anon key in VITE_SUPABASE_ANON_KEY (client)
- Service role key in SUPABASE_SERVICE_ROLE_KEY (server-only, used by `npm run seed:catalog` — never imported by client code)
- Client initialized in src/lib/supabase.js
- Auth: Google OAuth only
- RLS enabled on all tables — users see only their own data

## Auth & Routing
- Google OAuth via Supabase (`auth.signInWithOAuth`)
- `redirectTo` is hard-coded to `https://pot-heads.studio/auth/callback` in `src/lib/supabase.js`
- Vercel proxies `/auth/callback` → `https://kkagpnsekzsupwswnryo.supabase.co/auth/v1/callback` via rewrite in `vercel.json`
- Post-login redirect lands on `/board` — handled by `onAuthStateChange` in `App.jsx`
- Routes: `/` redirects to `/board`, `/board`, `/piece/:id`, `/graveyard`, `/catalog` (redirects to `/catalog/clay`), `/catalog/:tab` where `tab` ∈ {`clay`, `glazes`}
- All routes are auth-gated. The catalog uses Supabase RLS open SELECT, but the app's `App.jsx` redirects unauthenticated users to `Login`, so anonymous catalog browsing is not exposed (matches the private-by-default app design).

## Database Schema
Nine tables total.

User-scoped (RLS to auth.uid()): pieces, stage_events, photos, tags, piece_tags, user_clay_favorites, user_glaze_favorites
Public-readable reference (RLS open SELECT, mutations service-role only): clay_bodies, glazes

Stage enum: drying | bisque_ready | glazed | finished | lost
Storage bucket: "photos" (private), path pattern: {user_id}/{piece_id}/{filename}

Migration files live in `supabase/migrations/`. Catalog migration: `002_catalog_tables.sql`.
Seed JSON in `supabase/seed/`. Seeded via `npm run seed:catalog` (requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`).

## Pottery Workflow
Stages in order:
1. Drying — freshly thrown, waiting to be trimmed
2. Bisque Ready — trimmed, dry, left at studio for kiln firing
3. Glazed — returned from bisque, now glazed, waiting for glaze fire
4. Finished — complete, out of kiln
5. Lost — cracked, broken, or kiln casualty (soft delete, never hard delete)

User does NOT manage the kiln. Pieces sit at Bisque Ready until studio fires them.

## Development Rules
- Mobile-first always. Design for 390px width (iPhone 14 base).
- Use Tailwind utility classes only, no custom CSS files.
- No TypeScript — plain JS throughout.
- No form tags — use onClick/onChange handlers.
- All Supabase calls go in src/lib/ helper files, not inline in components.
- Compress images before upload using browser-image-compression (max 1600px, ~80% quality).
- Every clickable element must have `cursor-pointer` and a visible hover state (e.g. `hover:bg-*`, `hover:opacity-80`, `hover:text-*`). Never leave interactive elements without feedback on desktop.
- Upload photos to Supabase Storage at path: {user_id}/{piece_id}/{Date.now()}.jpg
- Always handle loading and error states in UI.
- Safe area insets: use pb-safe / pt-safe for iPhone notch/home bar.

## File Structure
See subdirectory CLAUDE.md files for detailed conventions:
- `src/lib/CLAUDE.md` — data layer patterns, batch functions, URL cache, useTagColors
- `src/pages/CLAUDE.md` — page-level data fetching patterns
- `src/components/CLAUDE.md` — component conventions and prop contracts

src/
  lib/
    supabase.js        — supabase client
    pieces.js          — all pieces CRUD; advanceStage uses Promise.all
    photos.js          — upload, batch fetch (getPhotosForPieces), signed URL cache
    tags.js            — tags CRUD, batch fetch (getTagsForPieces)
    useTagColors.js    — useTagColors hook, CATEGORY_DEFAULTS, detectColor
    catalog.js         — clay_bodies + glazes list, favorites toggle (user_clay_favorites, user_glaze_favorites)
  pages/
    Login.jsx          — Google OAuth sign in
    Board.jsx          — home, pieces grouped by stage; batch-fetches photos+tags in 3 total queries
    PieceDetail.jsx    — photo carousel, lightbox, stage timeline, tag management
    Graveyard.jsx      — lost pieces, hard delete
    Catalog.jsx        — clay/glaze browsable catalog with filters + favorites
  components/
    AddPiece.jsx           — camera-first new piece flow
    StageColumn.jsx        — stage group + PieceCard grid; props-only, no internal fetching
    PhotoTimeline.jsx      — UNUSED — superseded by PieceDetail inline photo handling
    TagChip.jsx            — colored tag pill (React.memo)
    BottomSheet.jsx        — reusable mobile sheet for modals
    PotteryPlaceholder.jsx — SVG fallback illustration when piece has no photos
    catalog/
      ClayCard.jsx, GlazeCard.jsx     — grid cards (React.memo)
      ClayDetail.jsx, GlazeDetail.jsx — detail body for BottomSheet
      HeartButton.jsx                  — outlined/filled favorite toggle
      SwatchInfo.jsx                   — info icon explaining hex_swatch is approximate
  App.jsx              — router + auth gate
  main.jsx             — entry point

supabase/
  migrations/          — SQL migrations applied via Supabase SQL editor (002_catalog_tables.sql)
  seed/                — JSON seed data for reference catalogs (clay_bodies.json, glazes.json)
scripts/
  seed-catalog.mjs     — Node ESM seed runner; loads .env.local via `node --env-file`

## Key UX Decisions
- Home screen: pieces grouped by stage (Drying / Bisque Ready / Glazed / Finished)
- Lost pieces hidden from board, accessible via filter
- Add piece flow: tap + → camera opens → photo taken → name + clay body → saved as Drying
- Stage advance: tap piece → detail view → "Move to next stage" button with optional photo + note
- Tags: chip UI, two categories (form: bowl/mug/vase etc, glaze: celadon/shino etc)
- No bulk kiln actions needed — user does not manage kiln

## localStorage Keys
| Key | Type | Purpose |
|-----|------|---------|
| `potheads_last_clay_body` | string | Pre-populates clay body field in AddPiece with last used value |
| `potheads_tag_colors` | object | `{ [tagName]: "#hex" }` — custom color per tag name, used by TagChip |
| `potheads_recent_tag_colors` | array | Last 8 colors used in Add Tag modal (most recent first) |

## Design Tokens (Tailwind v4 @theme)
Defined in `src/index.css`. Use these class names:
- `bg-clay` / `text-clay` → #78350f (primary CTA)
- `bg-clay-dark` / `text-clay-dark` → #5c2709 (pressed state)
- `bg-tan` → #c4a882 (card placeholder, photo bg)
- `bg-stage-complete` / `text-stage-complete` → #4a7c59 (sage green)
- `bg-stage-pending` / `border-stage-pending` → #d4c5b0
- `text-muted` → #7c5545 (accessible warm brown for secondary/label text; replaces light gray)
- `font-display` → Playfair Display, italic serif (wordmark, stage headers)

## PWA / iOS Notes
- Manifest configured in vite.config.js
- Add Apple meta tags to index.html (apple-mobile-web-app-capable etc)
- Camera input: use <input type="file" accept="image/*" capture="environment"> 
- Do NOT use getUserMedia API — not reliable in iOS PWA context

## Placeholder Assets
- 8 SVG illustrations in `public/placeholders/`: bowl, mug, cup, vase, plate, pitcher, teapot, planter
- `PotteryPlaceholder` component in `src/components/PotteryPlaceholder.jsx`
- SVGs loaded as `<img>` tags, not inline JSX
- Usage: show placeholder when piece has no photos; show real photo when one exists
- Default fallback for unknown form: `vase.svg`

## Explicitly Parked — Do Not Build These
- **Kiln batch mode** — user does not manage the kiln; never add bulk kiln actions
- **Analytics or drying time tracking** — no timers, no stage duration metrics
- **Shared studio / multi-user piece viewing** — app is strictly private per user
- **Marketplace or public portfolio** — `public` boolean on pieces is reserved for this later; do not wire it up yet
- **Push notifications**
- **Search** — stub the search icon only, do not implement search logic

## Current App State
Last updated: 2026-05-05

| File | Status | Notes |
|------|--------|-------|
| src/pages/Login.jsx | Complete | Google OAuth UI, error + loading states |
| src/pages/Board.jsx | Complete | Stage columns, multi-select, bulk delete, bulk tag edit |
| src/pages/PieceDetail.jsx | Complete | Hero photo carousel, lightbox, stage timeline, tag management, advance stage |
| src/components/StageColumn.jsx | Complete | Piece card grid per stage, thumbUrl/formTag passed as props (no per-card fetches), React.memo |
| src/components/AddPiece.jsx | Complete | New piece bottom sheet, stage selector, form tag, clay body memory |
| src/components/BottomSheet.jsx | Complete | Generic reusable bottom modal |
| src/components/TagChip.jsx | Complete | Colored tag pill, selected/remove states, React.memo |
| src/components/PotteryPlaceholder.jsx | Complete | SVG fallback when no photos |
| src/components/PhotoTimeline.jsx | Unused | Implemented but superseded by PieceDetail inline photo handling |
| src/lib/supabase.js | Complete | Client init, OAuth redirectTo hard-coded to production URL |
| src/lib/pieces.js | Complete | CRUD, stage progression, markLost |
| src/lib/photos.js | Complete | Compressed upload, signed URLs (cached), batch fetch, stage tagging |
| src/lib/tags.js | Complete | Preset + custom tags, CRUD, batch fetch |
| src/lib/useTagColors.js | Complete | Tag color hook shared by PieceDetail + TagChip |
| src/App.jsx | Complete | Router + auth guard |
| src/main.jsx | Complete | React 19 entry point |
| public/placeholders/*.svg | Complete | 8 form illustrations (bowl, mug, cup, vase, plate, pitcher, teapot, planter) |
| public/icon-192.png, icon-512.png | Complete | PWA icons |
| vercel.json | Complete | Auth callback rewrite rule |
| .npmrc | Complete | legacy-peer-deps=true |
| src/pages/Catalog.jsx | Complete | Clay/glaze tabs, search, filter chips, optimistic favorite toggle, BottomSheet detail |
| src/lib/catalog.js | Complete | listClayBodies, listGlazes, listClay/GlazeFavorites, toggleClay/GlazeFavorite |
| src/components/catalog/* | Complete | ClayCard, GlazeCard, ClayDetail, GlazeDetail, HeartButton, SwatchInfo |
| supabase/migrations/002_catalog_tables.sql | Complete | clay_bodies, glazes, user_*_favorites tables + RLS |
| supabase/seed/*.json | Complete | 28 clay bodies, 27 glazes from TPS 9th St |
| scripts/seed-catalog.mjs | Complete | Idempotent upsert on slug; needs SUPABASE_SERVICE_ROLE_KEY |
