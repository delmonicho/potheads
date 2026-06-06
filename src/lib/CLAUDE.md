# src/lib — Data & Service Layer

## Conventions
- All Supabase calls live here — never inline in components or pages.
- Functions throw on error (callers handle with try/catch).
- Batch functions are preferred over per-item calls when operating on multiple records.

## Module Overview

### supabase.js
Single Supabase client instance. `redirectTo` is hard-coded to the production URL — intentional, see root CLAUDE.md Auth section.

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

- `listClayBodies()` / `listGlazes()` — public-readable, returns full rows ordered by name.
- `listClayFavorites(userId)` / `listGlazeFavorites(userId)` — returns a `Set<id>` for O(1) membership checks in render.
- `toggleClayFavorite(userId, id, on)` / `toggleGlazeFavorite(userId, id, on)` — insert ignores 23505 duplicate-key, delete by composite match.

The `clay_bodies` and `glazes` tables are public-readable; mutations are service-role only (no UI for editing). Seed via `npm run seed:catalog`.

### useTagColors.js
Custom React hook and shared constants for tag color management.

Exports:
- `CATEGORY_DEFAULTS` — `{ form: '#78350f', glaze: '#4a7c59' }` — default chip colors per category. Import this wherever a fallback color is needed; do **not** hardcode these values.
- `detectColor(name)` — returns a hex color if the tag name contains a recognizable color word (e.g. "cobalt blue" → `#0047ab`). Used to auto-suggest a color as the user types a tag name.
- `useTagColors()` — manages `potheads_tag_colors` and `potheads_recent_tag_colors` localStorage keys, exposes `{ tagColors, recentColors, saveTagColor, addRecentColor }`.

## Performance Patterns

### Board load: 3 queries, not 2N
Board.jsx fetches pieces, then calls `getPhotosForPieces` and `getTagsForPieces` in parallel. Total: 3 Supabase queries regardless of piece count. Do not regress this by fetching photos/tags per-piece.

### Signed URL deduplication
The URL cache in `photos.js` is persisted to `localStorage` (`potheads_signed_urls`), so it survives renders, navigations, **and full page reloads** within the 24h URL validity. Combined with `getPhotoUrls` batch signing, a board load costs 1 Storage request for the misses (often 0 after the first session). Do not regress to per-photo `getPhotoUrl` in a loop — that re-introduces N Storage requests per load.
