# src/components — UI Components

## StageColumn.jsx
Renders one stage group (header + piece card grid) on the Board.

**Props:** `stage`, `pieces`, `thumbUrls`, `formTags`, `glazeTags`, `stageDates`, `selectMode`, `selectedIds`, `onToggleSelect`, `collapsed`, `onToggleCollapsed`

- `thumbUrls`, `formTags`, `glazeTags`, `stageDates` are plain objects (`{ [pieceId]: value }`) pre-computed by Board.jsx. `glazeTags` values are `{ name, color }` (the piece's primary glaze-category tag); `stageDates` values are an ISO timestamp string (or `null`) — the piece's latest `stage_events.moved_at` for its *current* stage, falling back to `piece.created_at` when it never transitioned into that stage.
- `PieceCard` (internal) is wrapped in `React.memo` — re-renders only when its props change.
- **`formTag` is display-only for `PotteryPlaceholder`'s illustration choice now** — it is no longer rendered as a caption on the card. The caption slot instead renders `glazeTag` as a small color dot + name (falls back to `CATEGORY_DEFAULTS.glaze` when the tag has no explicit `color`), since the glaze reads better on a shelf than the shape word does. Form stays available as a board filter/group-by (`viewMode === 'form'` in Board.jsx) — this only affects the passive card caption.
- **Stage-advance date on the card caption** — `PieceCard` computes `dateLabel = fmtStageDate(stageDate)` (`src/lib/pieces.js`) whenever `current_stage !== 'finished'`. If a `glazeTag` is present the date is appended after the glaze name on the same line (`· Jul 15`); otherwise it renders alone in the same small-caps `text-muted` style (this is the normal case for Drying/Bisque Ready, which don't carry a glaze tag). Finished cards never show a date — only the persisted glaze chip, if any, unchanged from before.
- **Per-stage tint + "finished" gold treatment** — `PieceCard` tints its own background off `piece.current_stage` via `STAGE_COLORS` (`src/lib/pieces.js`), applied as an inline style (dynamic per-piece color, can't be a static Tailwind class). When `current_stage === 'finished' && !piece.lost`, the card instead gets a `border-gold`/`bg-gold/12` treatment plus a small gold sparkle badge (top-right, so it never collides with the top-left selection checkbox). `StageColumn`'s own header gets the matching gold underline + sparkle glyph only when `stage === 'finished'`.
- `StageColumn` itself is also `React.memo` — only re-renders when its stage's pieces or the thumb/tag maps change.
- **Collapsible sections** — the header (title + count) is a `<button>`; tapping it calls `onToggleCollapsed(stage)`. A chevron (rotates `-90deg` when `collapsed`) sits next to the count. When `collapsed`, the piece grid isn't rendered at all — no `PieceCard`/`<img>` mounts, so collapsed sections cost zero image loads until expanded. Collapse state itself lives in Board.jsx (`collapsedStages`, persisted via `src/lib/prefs.js`'s `getCollapsedStages`/`setStageCollapsed`, localStorage `potheads_collapsed_stages`, default `{ finished: true }`) — `StageColumn` is just a controlled view over it, so the same collapse affordance applies uniformly to every stage.
- **No fetching inside PieceCard.** All data comes from props. Do not add `useEffect` data fetching here.

## TagChip.jsx
Colored tag pill. Wrapped in `React.memo` — used in tight loops in Board and PieceDetail.

`color` prop takes precedence. Falls back to `CATEGORY_DEFAULTS[tag.category]` imported from `src/lib/useTagColors.js`. Do **not** hardcode fallback colors here.

Props:
- `tag` — `{ id, name, category }`
- `selected` — filled style vs. outline style
- `color` — hex string override
- `onToggle` — optional, makes chip interactive
- `onRemove` — optional, adds × button

## RequireAuth.jsx
Auth gate wrapper for **private** routes. Props: `user`, `loading`, `children`. Renders a spinner while the session resolves, `Login` when there's no user, otherwise the children. `App.jsx` wraps every route in this **except** the public `/p/:slug`. Reproduces the pre-portfolio inline gate — do not re-add a gate inside `App`'s body.

## BottomSheet.jsx
Generic reusable bottom modal. Accepts `open`, `onClose`, `title`, `children`, optional `zClassName` for z-index override (used when stacking sheets, e.g., Add Tag over Edit Tags).

## portfolio/

Public-portfolio components.

### MuseumLabel.jsx
Museum-style caption for one portfolio piece. Reads **only** the denormalized `portfolio_item` fields (title, year, form, clay_body, glazes `[{name,hex}]`, firing, dimensions, status) — never piece/tag data. Empty fields are hidden. Status renders as a pill (Available highlighted; Sold/NFS muted).

## AddPiece.jsx
New piece flow. Uses a bottom sheet with camera-first input. Remembers last clay body in `potheads_last_clay_body` localStorage key.

## ClayBodyPicker.jsx
`<select>` of clay bodies (catalog + the user's previously-used + session-added), with an inline "+ Add new clay" custom-entry mode. Used by `AddPiece` and `PieceDetail`'s Edit-piece sheet.

**`active` prop (default `true`) gates the two catalog queries** (`listClayBodies` + `getClayBodies`). `BottomSheet` keeps its children mounted while closed, so without this gate the picker fetches on every page that hosts the sheet, even when it's never opened. Callers pass `active={<sheetOpen>}` so the fetch fires only when the sheet is actually open.

## PotteryPlaceholder.jsx
SVG fallback when a piece has no photos. Selects the illustration matching the `formTag` prop (bowl, mug, etc.), falling back to `vase.svg`.

## catalog/

Catalog-specific components — only rendered on `/catalog/:tab`.

### ClayCard.jsx / GlazeCard.jsx
Grid cards (square swatch + name + meta + heart). Both wrapped in `React.memo` since the grid can render 28 clay or 27 glaze cards. `onToggleFavorite(id, on)` and `onOpen(row)` come from the page; the card never fetches.

### ClayDetail.jsx / GlazeDetail.jsx
Renders inside a `BottomSheet` body. Use the local `<Field>` helper which silently hides null/empty fields — keeps detail dense without empty rows.

`GlazeDetail` also has an **edit mode** for user-owned custom glazes: pass `editable` (true only when `glaze.user_id === user.id`), `onSave(fields)`, `saving`, and `saveError`. When editable it shows an "Edit glaze" button that swaps the read-only body for an inline form (name, swatch color, finish, family, base color, food-safe, notes). Callers should `key={glaze.id}` the component so its internal `editing`/form state resets when a different glaze opens (BottomSheet keeps children mounted). `PieceDetail.jsx` passes `editable`; `Catalog.jsx` currently renders it read-only.

### HeartButton.jsx
Outlined when `favorite=false`, filled brown (`#78350f`) when true. `onClick` calls `e.stopPropagation()` so it works inside clickable card containers. `React.memo` because cards re-render only when their favorite flag flips.

### SwatchInfo.jsx
Tiny info `(i)` icon next to "Approx. fired color" labels. Tooltip warns the swatch is not a spec — fired color depends on glaze, atmosphere, kiln load, thickness. Required by the catalog spec — do not render hex_swatch as a color authority anywhere without this.
