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

## BottomSheet.jsx
Generic reusable bottom modal. Accepts `open`, `onClose`, `title`, `children`, optional `zClassName` for z-index override (used when stacking sheets, e.g., Add Tag over Edit Tags).

## AddPiece.jsx
New piece flow. Uses a bottom sheet with camera-first input. Remembers last clay body in `potheads_last_clay_body` localStorage key.

## PotteryPlaceholder.jsx
SVG fallback when a piece has no photos. Selects the illustration matching the `formTag` prop (bowl, mug, etc.), falling back to `vase.svg`.
