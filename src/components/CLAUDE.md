# src/components — UI Components

## StageColumn.jsx
Renders one stage group (header + piece card grid) on the Board.

**Props:** `stage`, `pieces`, `thumbUrls`, `formTags`, `selectMode`, `selectedIds`, `onToggleSelect`

- `thumbUrls` and `formTags` are plain objects (`{ [pieceId]: value }`) pre-computed by Board.jsx.
- `PieceCard` (internal) is wrapped in `React.memo` — re-renders only when its props change.
- `StageColumn` itself is also `React.memo` — only re-renders when its stage's pieces or the thumb/tag maps change.
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

### PortfolioItemEditor.jsx
BottomSheet form for the curated label overrides of one showcased item (title, year, form, clay_body, glazes as comma-separated text, firing, dimensions, status segmented buttons, show-process toggle). Controlled by the caller's `onSave(fields)` / `saving` / `error`; key it `key={item.id}` so form state resets per item. Glaze hex is preserved by name when re-saving; new glaze names get `null` hex.

### EditorialLayout.jsx / MasonryLayout.jsx
The two public-page gallery layouts, chosen by `portfolio.layout`. Both take `items` + `onOpen(item, index)` (opens the page's shared lightbox). Editorial is single-column (hero + thumbnail strip + full `MuseumLabel` + `ProcessStrip`); masonry is 2-col `columns-2` with natural-ratio images and a compact caption.

### ProcessStrip.jsx
Collapsible "How it was made" reveal under an editorial item. Builds one thumbnail per stage (drying→finished) from the item's already-public `photos` (`photos.stage`); renders nothing unless 2+ stages have photos. Tapping a step calls `onOpenPhoto(indexInItemPhotos)`.

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
