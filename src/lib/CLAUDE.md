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

**Signed URL cache** — `getPhotoUrl(path)` maintains a module-level `Map` keyed by storage path. URLs are cached for 55 minutes (5 min buffer before the 1-hour Supabase expiry). This eliminates redundant signed URL API calls when the same photo is rendered multiple times (e.g., Board → PieceDetail navigation).

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
The URL cache in `photos.js` is module-scoped — it persists across React renders and page navigations within a session. A photo's signed URL is only regenerated after 55 minutes or on page reload.
