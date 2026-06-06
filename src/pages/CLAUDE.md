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

**`fetchAll()`** uses `Promise.all` for the five initial data fetches (piece, photos, tags, stageEvents, pieceIds). The piece number count query and the adjacent-piece swipe prefetch run after.

**Lazily-loaded data — keep it off the initial load.** Two things the detail view needs only on interaction are deliberately *not* in `fetchAll`:
- `getUserTags(user.id)` — powers only the "Edit details" tag editor. Fetched the first time `showTagSheet` opens (guarded by `userTagsLoadedRef`); it's user-scoped so it survives swipe navigation, and mutation handlers refresh it in place.
- The clay-body catalog (`ClayBodyPicker`) — only the Edit-piece sheet uses it. The picker is passed `active={showEditPieceSheet}` so its two catalog queries fire only when that sheet is open (see `src/components/CLAUDE.md`).

Do not move either back into `fetchAll` — that re-adds 3 queries to every piece view for data the user may never open.

**Multiple refetches after mutations** — several handlers (handleAdvance, handleAddPhoto, handleChangePieceStage, handleEditStage, handleBulkDeletePhotos) call `await fetchAll()` after success. Signed URL caching in `photos.js` means repeated URL generation is cheap.

**Shared photo picker (`PhotoPickerField`)** — the camera-icon "Tap to add photos" dropzone + preview grid (with per-item `×` removal and a dashed "+" add-more tile) is a single helper component at the bottom of the file, used by **both** the Advance ("Move to Stage") sheet and the Edit Photos sheet. It's controlled (`files`/`previews` + `setFiles`/`setPreviews`), supports **multiple** photos, and creates object-URL previews without revoking them (matches prior behavior — don't add cleanup complexity). The Advance sheet uploads all picked files via `Promise.all` in `handleAdvance` and resets `advanceFiles`/`advancePreviews` on close. Do not reintroduce a raw `<input type="file">` in either sheet.

**Auto-advance on stage-tagged photos** — tagging a photo with a stage *later* than the piece's `current_stage` advances the piece, so the user doesn't have to open the Advance modal. The shared guard is `stageOutranksCurrent(stage)` (compares `STAGE_RANK`). It fires in `handleAddPhoto` (adding via Edit Photos, once regardless of photo count) and `handleEditStage` (retagging a photo's stage in the lightbox), each calling `advanceStage(id, stage, null)` after the photo write and before `fetchAll()`. Only moves forward — tagging the current/earlier stage never changes `current_stage`. Note Edit Photos pre-selects `addPhotoStage = piece.current_stage`, so a plain add never auto-advances; only an explicitly-later chip does.

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
