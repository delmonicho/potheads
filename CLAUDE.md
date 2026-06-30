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
- Routes: `/` redirects to `/board`, `/board`, `/piece/:id`, `/graveyard`, `/calendar`, `/catalog` (redirects to `/catalog/clay`), `/catalog/:tab` where `tab` ∈ {`clay`, `glazes`}, `/portfolio` (owner's private portfolio curate view), `/dev` (owner-only diagnostics — non-owners redirect to `/board`), and the **public, no-auth** `/p/:slug` (shareable portfolio page)
- `/dev` is gated to the owner allowlist `DEV_OWNER_EMAILS` via `isDevOwner(email)` (`src/lib/diagnostics.js`, default `nicho.delmo@gmail.com` + `ndelmoral13@gmail.com`, overridable via comma-separated `VITE_DEV_OWNER_EMAIL`). It's reachable in production via the URL or the "Developer diagnostics" link in the Board profile sheet (shown only to owners).
- **Auth gating lives in `App.jsx` via `RequireAuth`** (`src/components/RequireAuth.jsx`): every route is wrapped in `RequireAuth` (spinner while the session resolves → `Login` when there's no user → the page) **except `/p/:slug`**, which renders for anonymous visitors. The public portfolio reads via the same `supabase` client as the `anon` role, scoped by RLS (see Public Portfolio). The catalog uses Supabase RLS open SELECT but stays behind the gate, so anonymous catalog browsing is not exposed (matches the private-by-default design).

## Database Schema
Eleven tables total.

User-scoped (RLS to auth.uid()): pieces, stage_events, photos, tags, piece_tags, user_clay_favorites, user_glaze_favorites
Public-readable reference (RLS open SELECT, mutations service-role only): clay_bodies
Mixed reference — `glazes`: seed rows have `user_id = null` (global, public-readable, service-role only); custom rows are user-scoped (each user reads global + their own, and may insert/update/delete only their own). Added in `003_user_glazes.sql`.
Portfolio (owner-scoped writes + **public read of published rows**): portfolios, portfolio_items. Added in `004_portfolios.sql`.

Stage enum: drying | bisque_ready | glazed | finished | lost
Storage bucket: "photos" (private), path pattern: {user_id}/{piece_id}/{filename}

### Public Portfolio (RLS boundary — privacy-critical)
`portfolios` (one per user in v1; schema supports many) holds a vanity `slug`, `title`/`statement`/`studio_identity`, `layout`, `published`, `preview_token`, `view_count`. `portfolio_items` link a portfolio to a piece with `showcased`, `position`, and **denormalized curated labels** (`title`, `year`, `form`, `clay_body`, `glazes` jsonb `[{name,hex}]`, `firing`, `dimensions`, `status`). Labels are snapshotted from the piece at showcase time (`buildItemSnapshot`) so **the public read path never touches the private `pieces`/`tags` tables** — the only private table exposed to anon is `photos`, and only for showcased pieces of a published portfolio.

RLS (`004_portfolios.sql`): owners get `for all` on their own rows; **anon + authenticated** get `select` on `portfolios` where `published`, on `portfolio_items` where `showcased` AND parent published, on `photos` rows whose piece is showcased+published, and on `storage.objects` photo files for those pieces (path-matched via `split_part(name,'/',2)` = piece_id). Public-read policies are granted to both `anon` and `authenticated` so a signed-in visitor sees others' published portfolios too; owner drafts stay private. Never widen these predicates beyond `published AND showcased`.

Glazes on a piece are stored as `glaze`-category tags (name-based link). Every glaze the user selects lives in the `glazes` catalog (seed or their own custom row), so a case-insensitive name match (`matchGlaze` in `catalog.js`) resolves a glaze tag → its catalog entry. Custom glazes typed in-app are created as user-scoped catalog rows; renaming one cascades to its glaze tags.

Migration files live in `supabase/migrations/`. Catalog migrations: `002_catalog_tables.sql`, `003_user_glazes.sql` (user-scoped custom glazes). Portfolio migration: `004_portfolios.sql` (portfolios/portfolio_items + public-read RLS, incl. a `storage.objects` policy). **Apply all of these manually in the Supabase SQL editor** — the core `pieces`/`photos`/`tags` tables were created via the dashboard and are not tracked in git.
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
    supabase.js        — supabase client (wraps fetch to feed request telemetry to diagnostics.js)
    diagnostics.js     — in-memory client-side observability (request log/aggregates, cache hit stats); DEV_OWNER_EMAIL gate
    pieces.js          — all pieces CRUD; advanceStage uses Promise.all
    photos.js          — upload, batch fetch (getPhotosForPieces), signed URL cache
    tags.js            — tags CRUD, batch fetch (getTagsForPieces)
    useTagColors.js    — useTagColors hook, CATEGORY_DEFAULTS, detectColor
    catalog.js         — clay_bodies + glazes list (24h TTL cache), favorites toggle (user_clay_favorites, user_glaze_favorites)
    portfolio.js       — portfolios/portfolio_items CRUD; slug validation; buildItemSnapshot; getPublicPortfolio (anon read)
  pages/
    Login.jsx          — Google OAuth sign in
    Board.jsx          — home, pieces grouped by stage; batch-fetches photos+tags in 3 total queries
    PieceDetail.jsx    — photo carousel, lightbox, stage timeline, tag management
    Graveyard.jsx      — lost pieces, hard delete
    Catalog.jsx        — clay/glaze browsable catalog with filters + favorites
    PortfolioCurate.jsx — owner-only (/portfolio): create portfolio, toggle showcased pieces, edit details, publish/unpublish, share link
    PublicPortfolio.jsx — public, no-auth (/p/:slug): editorial single-column gallery with museum labels + lightbox
    Dev.jsx            — owner-only (/dev) diagnostics: Supabase request stats, cache stats, localStorage footprint, links to native metrics
  components/
    AddPiece.jsx           — camera-first new piece flow
    StageColumn.jsx        — stage group + PieceCard grid; props-only, no internal fetching
    RequireAuth.jsx        — auth gate wrapper for private routes (spinner → Login → page)
    PhotoTimeline.jsx      — UNUSED — superseded by PieceDetail inline photo handling
    TagChip.jsx            — colored tag pill (React.memo)
    BottomSheet.jsx        — reusable mobile sheet for modals
    PotteryPlaceholder.jsx — SVG fallback illustration when piece has no photos
    catalog/
      ClayCard.jsx, GlazeCard.jsx     — grid cards (React.memo)
      ClayDetail.jsx, GlazeDetail.jsx — detail body for BottomSheet
      HeartButton.jsx                  — outlined/filled favorite toggle
      SwatchInfo.jsx                   — info icon explaining hex_swatch is approximate
    portfolio/
      MuseumLabel.jsx                  — museum-style caption from denormalized portfolio_item fields
  App.jsx              — router; RequireAuth-gated private routes + public /p/:slug
  main.jsx             — entry point

supabase/
  migrations/          — SQL migrations applied via Supabase SQL editor (002_catalog_tables.sql, 003_user_glazes.sql, 004_portfolios.sql)
  seed/                — JSON seed data for reference catalogs (clay_bodies.json, glazes.json)
scripts/
  seed-catalog.mjs     — Node ESM seed runner; loads .env.local via `node --env-file`

## Key UX Decisions
- Home screen: pieces grouped by stage (Drying / Bisque Ready / Glazed / Finished)
- Lost pieces hidden from board, accessible via filter
- Add piece flow: tap + → camera opens → photo taken → name + clay body → saved as Drying
- Stage advance: tap piece → detail view → "Move to next stage" button with optional photo(s) + note. Also auto-advances: tagging a photo with a stage later than the current one (when adding via Edit Photos, or retagging a photo in the lightbox) moves the piece to that stage without opening the Advance modal.
- Tags: chip UI, two categories (form: bowl/mug/vase etc, glaze: celadon/shino etc)
- No bulk kiln actions needed — user does not manage kiln

## localStorage Keys
| Key | Type | Purpose |
|-----|------|---------|
| `potheads_last_clay_body` | string | Pre-populates clay body field in AddPiece with last used value |
| `potheads_tag_colors` | object | `{ [tagName]: "#hex" }` — custom color per tag name, used by TagChip |
| `potheads_recent_tag_colors` | array | Last 8 colors used in Add Tag modal (most recent first) |
| `potheads_signed_urls` | object | `{ [storagePath]: { url, expiresAt } }` — persisted signed-URL cache so PWA reloads reuse still-valid URLs instead of re-signing (see `src/lib/photos.js`) |
| `potheads_catalog_cache` | object | `{ clay: { rows, expiresAt }, glaze: { [userId]: { rows, expiresAt } } }` — persisted reference-catalog cache (24h TTL) so clay/glaze catalogs aren't re-fetched on every Catalog mount or PieceDetail glaze load (see `src/lib/catalog.js`) |

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
- **Shared studio / multi-user piece viewing** — app is strictly private per user (note: the *public portfolio* feature is a deliberate, RLS-enforced exception — only explicitly showcased pieces of a published portfolio are world-readable; the private board is unchanged)
- **Push notifications**
- **Search** — stub the search icon only, do not implement search logic

## Current App State
Last updated: 2026-06-30

| File | Status | Notes |
|------|--------|-------|
| src/pages/Login.jsx | Complete | Google OAuth UI, error + loading states |
| src/pages/PortfolioCurate.jsx | Phase 1 | Create portfolio (validated slug), toggle showcased pieces, edit title/statement/identity, publish/unpublish, copy/open share link. Reorder, per-item label editor, layout switch, preview = Phase 2 |
| src/pages/PublicPortfolio.jsx | Phase 1 | Public no-auth /p/:slug — editorial single-column, museum labels, multi-photo lightbox. Masonry, process strip, OG/SSR, QR/share, view counter = later phases |
| src/components/RequireAuth.jsx | Complete | Auth gate wrapper for private routes |
| src/components/portfolio/MuseumLabel.jsx | Complete | Museum caption from denormalized portfolio_item fields |
| src/lib/portfolio.js | Phase 1 | getMyPortfolio/createPortfolio/updatePortfolio, getPortfolioItems, showcasePiece/setItemShowcased, buildItemSnapshot, slugify/validateSlug, getPublicPortfolio |
| supabase/migrations/004_portfolios.sql | Phase 1 | portfolios + portfolio_items tables; owner + public-read RLS; storage.objects anon policy |
| src/pages/Board.jsx | Complete | Stage columns, multi-select, bulk delete, bulk tag edit; group-by view: stage / clay body / glaze / form |
| src/pages/PieceDetail.jsx | Complete | Hero carousel, lightbox, stage timeline, advance stage (glaze picker shown when target is Glazed/Finished); dedicated Clay Body section (tap chip → read-only ClayDetail) + Glaze section (catalog search/select + custom, tap chip → editable GlazeDetail) separate from form/custom tags |
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
| src/App.jsx | Complete | Router + auth guard; owner-gated `/dev` route |
| src/main.jsx | Complete | React 19 entry point |
| src/lib/diagnostics.js | Complete | Client-side request/cache telemetry store + DEV_OWNER_EMAIL gate |
| src/pages/Dev.jsx | Complete | Owner-only `/dev` diagnostics: request stats, cache stats, localStorage footprint, clear-cache actions, native-metrics links |
| public/placeholders/*.svg | Complete | 8 form illustrations (bowl, mug, cup, vase, plate, pitcher, teapot, planter) |
| public/icon-192.png, icon-512.png | Complete | PWA icons |
| vercel.json | Complete | Auth callback rewrite rule |
| .npmrc | Complete | legacy-peer-deps=true |
| src/pages/Catalog.jsx | Complete | Clay/glaze tabs, search, filter chips, optimistic favorite toggle, BottomSheet detail |
| src/lib/catalog.js | Complete | listClayBodies, listGlazes(userId) — both 24h TTL-cached (potheads_catalog_cache); listClay/GlazeFavorites, toggleClay/GlazeFavorite; buildGlazeIndex/matchGlaze (name→glaze) + buildClayIndex/matchClay (name→clay); createGlaze/updateGlaze (user-scoped custom glazes, bust glaze cache) |
| src/components/catalog/* | Complete | ClayCard, GlazeCard, ClayDetail, GlazeDetail (read + edit mode for own custom glazes), HeartButton, SwatchInfo |
| supabase/migrations/002_catalog_tables.sql | Complete | clay_bodies, glazes, user_*_favorites tables + RLS |
| supabase/migrations/003_user_glazes.sql | Complete | adds `glazes.user_id` + RLS for user-scoped custom glazes (apply via Supabase SQL editor) |
| supabase/seed/*.json | Complete | 28 clay bodies, 27 glazes from TPS 9th St |
| scripts/seed-catalog.mjs | Complete | Idempotent upsert on slug; needs SUPABASE_SERVICE_ROLE_KEY |
