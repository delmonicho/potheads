import { supabase } from './supabase.js'
import { STAGES } from './pieces.js'
import { getPhotosForPieces, getPhotoUrls } from './photos.js'

// ─────────────────────────────────────────────────────────────────────────────
// Slugs — user-chosen vanity slug for /p/{slug}, validated for format,
// reserved words, and (via the unique constraint) collisions.
// ─────────────────────────────────────────────────────────────────────────────

// Reserved so a slug can never shadow an app route or an obviously-bad word.
const RESERVED_SLUGS = new Set([
  'board', 'piece', 'graveyard', 'catalog', 'calendar', 'dev', 'auth', 'api',
  'p', 'login', 'admin', 'new', 'edit', 'settings', 'about', 'help',
  'fuck', 'shit', 'cunt', 'nigger', 'faggot',
])

export function slugify(input) {
  return (input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

// Returns an error string if invalid, or null if the slug is acceptable.
export function validateSlug(slug) {
  if (!slug) return 'Pick a link name'
  if (!/^[a-z0-9-]+$/.test(slug)) return 'Use only lowercase letters, numbers, and dashes'
  if (slug.length < 3) return 'Too short (3+ characters)'
  if (slug.length > 40) return 'Too long (40 characters max)'
  if (slug.startsWith('-') || slug.endsWith('-')) return 'Cannot start or end with a dash'
  if (RESERVED_SLUGS.has(slug)) return 'That name is reserved — try another'
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Portfolio (one per user in v1; schema supports many).
// ─────────────────────────────────────────────────────────────────────────────

export async function getMyPortfolio(userId) {
  const { data, error } = await supabase
    .from('portfolios')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createPortfolio(userId, { slug, title }) {
  const { data, error } = await supabase
    .from('portfolios')
    .insert({ user_id: userId, slug, title: title || null })
    .select()
    .single()
  if (error) {
    if (error.code === '23505') throw new Error(`The link "${slug}" is already taken`)
    throw error
  }
  return data
}

const PORTFOLIO_FIELDS = ['slug', 'title', 'statement', 'studio_identity', 'layout', 'published']

export async function updatePortfolio(portfolioId, fields) {
  const patch = {}
  for (const k of PORTFOLIO_FIELDS) {
    if (fields[k] !== undefined) patch[k] = fields[k]
  }
  if (Object.keys(patch).length === 0) return
  const { data, error } = await supabase
    .from('portfolios')
    .update(patch)
    .eq('id', portfolioId)
    .select()
    .single()
  if (error) {
    if (error.code === '23505') throw new Error(`The link "${fields.slug}" is already taken`)
    throw error
  }
  return data
}

// ─────────────────────────────────────────────────────────────────────────────
// Items — curation. Labels are denormalized from the piece at showcase time so
// the public page never reads the private pieces/tags tables.
// ─────────────────────────────────────────────────────────────────────────────

// Pure helper (no DB): derive the curated label snapshot from a piece + its
// tags. Glaze hex comes from the glaze tag's stored color (set from hex_swatch
// when the glaze was picked from the catalog), so no catalog fetch is needed.
export function buildItemSnapshot(piece, tags = []) {
  const formTag = tags.find((t) => t.category === 'form' && t.name !== 'lost')
  const glazeTags = tags.filter((t) => t.category === 'glaze')
  return {
    title: piece.name || null,
    form: formTag ? formTag.name : null,
    clay_body: piece.clay_body || null,
    glazes: glazeTags.length ? glazeTags.map((t) => ({ name: t.name, hex: t.color || null })) : null,
    status: 'nfs',
  }
}

// All items for the owner's curate view (showcased and not), ordered.
export async function getPortfolioItems(portfolioId) {
  const { data, error } = await supabase
    .from('portfolio_items')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .order('position', { ascending: true })
  if (error) throw error
  return data
}

// Showcase a piece: create the item (or flip it back on), snapshotting labels.
// position defaults to the end of the list.
export async function showcasePiece(portfolioId, piece, snapshot, position) {
  const row = {
    portfolio_id: portfolioId,
    piece_id: piece.id,
    showcased: true,
    position,
    ...snapshot,
  }
  const { data, error } = await supabase
    .from('portfolio_items')
    .upsert(row, { onConflict: 'portfolio_id,piece_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

// Hide a piece from the portfolio. The row is kept (labels survive) and just
// marked not-showcased, so re-showcasing later restores the curated labels.
export async function setItemShowcased(portfolioId, pieceId, showcased) {
  const { error } = await supabase
    .from('portfolio_items')
    .update({ showcased })
    .eq('portfolio_id', portfolioId)
    .eq('piece_id', pieceId)
  if (error) throw error
}

// ─────────────────────────────────────────────────────────────────────────────
// Public read — used by the no-auth /p/{slug} page. The same anon supabase
// client is used; RLS returns only a published portfolio + its showcased items +
// their photos. Reuses getPhotosForPieces / getPhotoUrls verbatim.
// ─────────────────────────────────────────────────────────────────────────────

const STAGE_RANK = STAGES.reduce((acc, s, i) => { acc[s] = i + 1; return acc }, {})

// Sort a piece's photos finished→drying (highest stage first), newest within a
// stage — same ordering the private PieceDetail carousel uses, so the portfolio
// leads with the finished shot.
function sortPhotos(photos) {
  return [...photos].sort((a, b) => {
    const rank = (STAGE_RANK[b.stage] || 0) - (STAGE_RANK[a.stage] || 0)
    if (rank !== 0) return rank
    return new Date(b.taken_at) - new Date(a.taken_at)
  })
}

// Returns { portfolio, items } where each item has a `photos: [{ ...photo, url }]`
// array (hero first), or null if no published portfolio matches the slug.
export async function getPublicPortfolio(slug) {
  const { data: portfolio, error } = await supabase
    .from('portfolios')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  if (!portfolio) return null

  const { data: items, error: itemsError } = await supabase
    .from('portfolio_items')
    .select('*')
    .eq('portfolio_id', portfolio.id)
    .eq('showcased', true)
    .order('position', { ascending: true })
  if (itemsError) throw itemsError

  if (!items.length) return { portfolio, items: [] }

  const pieceIds = items.map((it) => it.piece_id)
  const photosByPiece = await getPhotosForPieces(pieceIds)

  // Flatten every showcased piece's (sorted) photos into one ordered path list,
  // batch-sign in a single Storage request, then scatter the URLs back.
  const withPhotos = items.map((it) => ({
    ...it,
    photos: sortPhotos(photosByPiece.get(it.piece_id) || []),
  }))
  const flatPaths = withPhotos.flatMap((it) => it.photos.map((p) => p.storage_path))
  const urls = await getPhotoUrls(flatPaths).catch(() => [])

  let cursor = 0
  for (const it of withPhotos) {
    it.photos = it.photos.map((p) => ({ ...p, url: urls[cursor++] ?? null }))
  }

  return { portfolio, items: withPhotos }
}
