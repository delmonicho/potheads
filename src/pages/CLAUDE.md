# src/pages — Page Components

## Board.jsx
Home screen. Pieces grouped by stage in columns.

**Data fetching pattern — do not change without understanding this:**
1. `fetchAll()` fetches pieces via `getPieces(userId)`.
2. Then fires `getPhotosForPieces(pieceIds)` and `getTagsForPieces(pieceIds)` in **parallel**.
3. Derives `thumbUrls: { [pieceId]: signedUrl }` and `formTags: { [pieceId]: tagName }` from the batch results.
4. Passes these down to `StageColumn` → `PieceCard` as props.

This is **intentionally** a top-down data flow — `PieceCard` renders only from props, it does not fetch. Do not add fetching inside `StageColumn` or `PieceCard`.

**Bulk operations** use `Promise.all` — `handleBulkDelete` and `handleBulkToggleTag` fan out to all selected piece IDs simultaneously.

**`piecesByStage`** is memoized with `useMemo([pieces])` — recalculates only when the pieces array changes.

## PieceDetail.jsx
Single piece view. Manages hero photo carousel, stage timeline, tag editing, photo upload, lightbox.

**Tag colors** — uses `useTagColors()` from `src/lib/useTagColors.js`. Do not re-implement localStorage color logic inline; always use the hook.

**`fetchAll()`** uses `Promise.all` for the four initial data fetches (piece, photos, tags, userTags). The piece number count query runs after.

**Multiple refetches after mutations** — several handlers (handleAdvance, handleAddPhoto, handleChangePieceStage, handleEditStage, handleBulkDeletePhotos) call `await fetchAll()` after success. Signed URL caching in `photos.js` means repeated URL generation is cheap.

**Edit Photos sheet** — pencil icon (bottom-right of hero photo) opens a sheet that does two things in one place:
1. Existing photos in a 3-col grid; tap to multi-select; bulk delete via a stacked confirm sheet (`zClassName="z-[60]"`).
2. Below that, the same multi-add upload flow as before (file picker, optional stage chip, optional note).

Selection state (`selectedPhotoIds: Set`) is page-scoped and cleared whenever the sheet closes or after a successful delete or upload.

## Graveyard.jsx
Shows pieces tagged "lost" (or with `lost=true` boolean for legacy pieces). Each piece card has a "Delete forever" button that hard-deletes via `deletePiece`. Accessible via the broken vase icon in the Board header.

## Login.jsx
Google OAuth entry point. No complex state — just `loading` and `error`.

## Catalog.jsx
Clay & glaze reference catalog. Tabs (`clay` / `glazes`) come from the URL param. One page handles both — keeps fetched data and favorite sets in memory across tab switches.

**Data fetching pattern:**
1. `fetchAll()` issues `Promise.all` for clay bodies, glazes, clay favorites, glaze favorites — 4 queries on mount.
2. Favorites are stored as `Set<id>` for O(1) `has()` in render.
3. Filtering is client-side via `useMemo`. The corpus is small (~50 rows total) so this is cheaper than re-querying.

**Optimistic favorites** — `handleToggleClay`/`handleToggleGlaze` mutate the local `Set` first, then call `toggleClay/GlazeFavorite`. On error, revert and surface the message. The data layer's insert ignores 23505 (duplicate key), so re-toggling the same fav is safe.

**Tab switching** — `setTab(next)` resets tab-specific filters (category/texture/finish/foodSafe) but preserves search and "favorites only" because those are cross-cutting.

**Detail view** — `BottomSheet` reused from existing components; no new modal primitive.
