# src/lib — Data & Service Layer

## Conventions
- All Supabase calls live here — never inline in components or pages.
- Functions throw on error (callers handle with try/catch).
- Batch functions are preferred over per-item calls when operating on multiple records.

## Module Overview

### supabase.js
Single Supabase client instance. `redirectTo` is hard-coded to the production URL — intentional, see root CLAUDE.md Auth section.

The client is created with a custom `global.fetch` that times **every** Supabase request (REST/Storage/Auth) and reports `{ label, method, durationMs, status, ok }` to `diagnostics.js`. The wrapper is transparent — it returns the original `Response` and re-throws on failure, never altering behavior. Labels are derived from the URL path: `/rest/v1/<table>` → `rest:<table>`, storage → `storage:sign`/`storage:object`, auth → `auth`.

### diagnostics.js
Dependency-free, in-memory client-side observability for a single SPA session. Holds a ring buffer (last ~200) of request events plus per-label aggregates (count/errors/avg/p95/max) and per-cache hit/miss counters. All writes are wrapped in try/catch so instrumentation can never break a request.
- `recordRequest(evt)` — called by the supabase.js fetch wrapper.
- `recordCache(name, { hit })` — called by the signed-URL cache (`photos.js`, name `signedUrls`) and the catalog cache (`catalog.js`, name `catalog`). A cache **hit is the absence of a request**, so hit-rate is the real signal that caching is paying off.
- `getSnapshot()` / `subscribe(fn)` / `reset()` — read by the `/dev` page.
- `DEV_OWNER_EMAILS` / `isDevOwner(email)` — owner allowlist + case-insensitive check for `/dev`, here so it's importable without UI. Default owners `nicho.delmo@gmail.com` + `ndelmoral13@gmail.com`, override via comma-separated `VITE_DEV_OWNER_EMAIL`. `DEV_OWNER_EMAIL` (singular, = first owner) is still exported for back-compat.

### pieces.js
CRUD for the `pieces` table.
- `advanceStage(pieceId, stage, notes)` — runs the piece update and stage_event insert in **parallel** via `Promise.all`. Both writes are independent so there's no reason to sequence them.

### photos.js
Upload, fetch, signed URL generation, and deletion for the `photos` bucket.

**`deletePhoto(photoId, storagePath)`** — hard delete. DB row first (source of truth), then storage object. If storage removal fails the row is already gone — orphan is logged via `console.warn` and the user is unblocked. Also clears the `urlCache` entry for that path.

**Signed URL cache** — keyed by storage path, persisted to `localStorage` under `potheads_signed_urls`. URLs are signed for 24h (`SIGNED_URL_TTL_SECONDS`) and cached until 5 min before expiry. Persisting across reloads matters: each signed URL is one Storage API request, and a home-screen PWA relaunches constantly — without persistence every reload re-signs every visible photo. `loadUrlCache()` rehydrates (dropping expired entries) on module load; `persistUrlCache()` writes back, debounced 500ms. `deletePhoto` evicts and re-persists.

**Batch signing — use `getPhotoUrls(paths)`, not `getPhotoUrl` in a loop.** `getPhotoUrls` serves cache hits with zero network and signs the remaining misses in a **single** `createSignedUrls` request, returning URLs aligned to input order (null per failed path). This is the main lever on Storage request volume — N per-photo `createSignedUrl` calls collapse to 1. `getPhotoUrl(path)` is a thin singular wrapper over it (used only by the unused `PhotoTimeline`). All page call sites (Board, Graveyard, PieceDetail) use the batch form.

**Batch fetch** — `getPhotosForPieces(pieceIds)` fetches all photos for a list of piece IDs in a single query and returns a `Map<pieceId, Photo[]>` (photos ordered by `taken_at DESC`). Use this instead of calling `getPhotosForPiece` in a loop.

### tags.js
Tag CRUD and piece↔tag association.

**Batch fetch** — `getTagsForPieces(pieceIds)` fetches all piece_tags for a list of piece IDs in a single query and returns a `Map<pieceId, Tag[]>`. Use this instead of calling `getTagsForPiece` in a loop.

### catalog.js
Reference catalogs (clay bodies + glazes) and per-user favorites.

- `listClayBodies()` / `listGlazes(userId)` — public-readable, returns full rows ordered by name. **TTL-cached (24h)** in module memory + `localStorage` (`potheads_catalog_cache`) so this near-static reference data isn't re-fetched on every Catalog mount / PieceDetail glaze load. `clay_bodies` is fully global so it caches under one key; `glazes` includes the user's own custom rows (RLS), so its cache is **keyed by `userId`** (pass it from call sites) and **invalidated** by `createGlaze`/`updateGlaze`. Cache hits/misses report to `diagnostics.js` (name `catalog`). Helpers: `clearCatalogCache()`, `getCatalogCacheStats()`. Favorites are **not** cached (user state, single cheap query).
- `listClayFavorites(userId)` / `listGlazeFavorites(userId)` — returns a `Set<id>` for O(1) membership checks in render.
- `toggleClayFavorite(userId, id, on)` / `toggleGlazeFavorite(userId, id, on)` — insert ignores 23505 duplicate-key, delete by composite match.
- `buildGlazeIndex(glazes)` → `Map<lowerName, glaze>` and `matchGlaze(index, tagName)` — pure helpers (no DB) that resolve a glaze tag name → its catalog row, case-insensitively. Duplicate names tie-break by `slug`. This is how name-based glaze tags link to the catalog.
- `buildClayIndex(clays)` → `Map<lowerName, clay>` and `matchClay(index, name)` — the clay equivalent of the glaze pair. Resolves a piece's free-text `clay_body` → its `clay_bodies` catalog row so PieceDetail can show a swatch-colored chip + read-only `ClayDetail`.
- `createGlaze(userId, fields)` / `updateGlaze(glazeId, fields)` — create/edit a **user-scoped** custom glaze (`user_id = userId`, auto-generated unique slug). Requires migration `003`. Editable fields: name, finish, family, base_color, hex_swatch, food_safe, notes.

`clay_bodies` is public-readable, mutations service-role only. `glazes` is public-readable for seed rows (`user_id null`); each user can also read + write their own custom rows (RLS, migration `003`). Seed via `npm run seed:catalog` (inserts global rows with `user_id null`).

### portfolio.js
Public-portfolio data layer (tables `portfolios`, `portfolio_items`; migration `004`).

- `getMyPortfolio(userId)` / `createPortfolio(userId, {slug, title})` / `updatePortfolio(id, fields)` — one portfolio per user in v1. Create/update surface `23505` as a friendly "link is already taken" error.
- `slugify(input)` / `validateSlug(slug)` — vanity-slug helpers. `validateSlug` returns an error string or `null`; enforces format (lowercase + digits + dashes, 3–40 chars) and a `RESERVED_SLUGS` blocklist (app routes + profanity). Collisions are caught at insert via the unique constraint.
- `buildItemSnapshot(piece, tags)` — **pure** (no DB). Derives the denormalized curated labels (title, form, clay_body, glazes `[{name, hex}]` from glaze tags' stored color, status default `nfs`). This is what keeps the public page off the private `pieces`/`tags` tables — labels are snapshotted at showcase time.
- `getPortfolioItems(portfolioId)` — owner view (showcased + not), ordered by `position`.
- `showcasePiece(portfolioId, piece, snapshot, position)` — upsert (`onConflict: portfolio_id,piece_id`) with `showcased: true`. `setItemShowcased(portfolioId, pieceId, bool)` flips visibility but keeps the row so labels survive a re-showcase.
- `getPublicPortfolio(slug)` — the **anon read path**. Returns `{ portfolio, items }` (each item carries a hero-first `photos: [{...photo, url}]`) or `null` when no published portfolio matches (RLS returns nothing for anon on unpublished). Reuses `getPhotosForPieces` + a single batched `getPhotoUrls` for all showcased photos; sorts photos finished→drying like PieceDetail. Works for the owner previewing their own draft (owner RLS) and for anon on published (public RLS) with no code branch.

### useTagColors.js
Custom React hook and shared constants for tag color management.

Exports:
- `CATEGORY_DEFAULTS` — `{ form: '#78350f', glaze: '#4a7c59' }` — default chip colors per category. Import this wherever a fallback color is needed; do **not** hardcode these values.
- `detectColor(name)` — returns a hex color if the tag name contains a recognizable color word (e.g. "cobalt blue" → `#0047ab`). Used to auto-suggest a color as the user types a tag name.
- `useTagColors()` — manages `potheads_tag_colors` and `potheads_recent_tag_colors` localStorage keys, exposes `{ tagColors, recentColors, saveTagColor, addRecentColor }`.

## Performance Patterns

### Board load: 4 queries, not 2N
Board.jsx fetches pieces, then calls `getPhotosForPieces`, `getTagsForPieces`, `getUserTags`, and `getStageEventsForUser` in parallel. Total: 4 Supabase queries regardless of piece count. `getStageEventsForUser` is unfiltered per-piece (RLS-scoped to the user) so it stays O(1) — it powers both the day-mode calendar view and the per-card "advanced on <date>" timestamp on the main stage-column board. Do not regress this by fetching photos/tags/events per-piece.

### Signed URL deduplication
The URL cache in `photos.js` is persisted to `localStorage` (`potheads_signed_urls`), so it survives renders, navigations, **and full page reloads** within the 24h URL validity. Combined with `getPhotoUrls` batch signing, a board load costs 1 Storage request for the misses (often 0 after the first session). Do not regress to per-photo `getPhotoUrl` in a loop — that re-introduces N Storage requests per load.
