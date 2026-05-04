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

**Multiple refetches after mutations** — several handlers (handleAdvance, handleAddPhoto, handleChangePieceStage, handleEditStage) call `await fetchAll()` after success. Signed URL caching in `photos.js` means repeated URL generation is cheap.

## Graveyard.jsx
Shows pieces tagged "lost" (or with `lost=true` boolean for legacy pieces). Each piece card has a "Delete forever" button that hard-deletes via `deletePiece`. Accessible via the broken vase icon in the Board header.

## Login.jsx
Google OAuth entry point. No complex state — just `loading` and `error`.
