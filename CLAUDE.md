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

## Supabase
- Project URL in VITE_SUPABASE_URL
- Anon key in VITE_SUPABASE_ANON_KEY
- Client initialized in src/lib/supabase.js
- Auth: Google OAuth only
- RLS enabled on all tables — users see only their own data

## Database Schema
Five tables: pieces, stage_events, photos, tags, piece_tags
Stage enum: drying | bisque_ready | glazed | finished | lost
Storage bucket: "photos" (private), path pattern: {user_id}/{piece_id}/{filename}

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
- Upload photos to Supabase Storage at path: {user_id}/{piece_id}/{Date.now()}.jpg
- Always handle loading and error states in UI.
- Safe area insets: use pb-safe / pt-safe for iPhone notch/home bar.

## File Structure
src/
  lib/
    supabase.js        — supabase client (already exists)
    pieces.js          — all pieces CRUD
    photos.js          — upload + fetch photos
    tags.js            — tags CRUD
  pages/
    Login.jsx          — Google OAuth sign in
    Board.jsx          — home, pieces grouped by stage
    PieceDetail.jsx    — photo timeline, stage advance, tags
  components/
    AddPiece.jsx       — camera-first new piece flow
    StageColumn.jsx    — one stage group on the board
    PhotoTimeline.jsx  — vertical photo log per piece
    TagChip.jsx        — colored tag pill
    BottomSheet.jsx    — reusable mobile sheet for modals
  App.jsx              — router + auth gate
  main.jsx             — entry point

## Key UX Decisions
- Home screen: pieces grouped by stage (Drying / Bisque Ready / Glazed / Finished)
- Lost pieces hidden from board, accessible via filter
- Add piece flow: tap + → camera opens → photo taken → name + clay body → saved as Drying
- Stage advance: tap piece → detail view → "Move to next stage" button with optional photo + note
- Tags: chip UI, two categories (form: bowl/mug/vase etc, glaze: celadon/shino etc)
- No bulk kiln actions needed — user does not manage kiln

## localStorage Keys
| Key | Type | Purpose |
|-----|------|---------|
| `potheads_last_clay_body` | string | Pre-populates clay body field in AddPiece with last used value |

## Design Tokens (Tailwind v4 @theme)
Defined in `src/index.css`. Use these class names:
- `bg-clay` / `text-clay` → #78350f (primary CTA)
- `bg-clay-dark` / `text-clay-dark` → #5c2709 (pressed state)
- `bg-tan` → #c4a882 (card placeholder, photo bg)
- `bg-stage-complete` / `text-stage-complete` → #4a7c59 (sage green)
- `bg-stage-pending` / `border-stage-pending` → #d4c5b0
- `font-display` → Playfair Display, italic serif (wordmark, stage headers)

## PWA / iOS Notes
- Manifest configured in vite.config.js
- Add Apple meta tags to index.html (apple-mobile-web-app-capable etc)
- Camera input: use <input type="file" accept="image/*" capture="environment"> 
- Do NOT use getUserMedia API — not reliable in iOS PWA context

## Out of Scope (for now)
- Shared studio / multi-user viewing
- Analytics or drying time tracking
- Marketplace / public portfolio (public boolean on pieces is reserved for later)
- Push notifications
