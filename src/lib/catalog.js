import { supabase } from './supabase.js'
import { recordCache } from './diagnostics.js'

// Reference-catalog cache. clay_bodies is fully global/static; glazes is global
// seed rows + the signed-in user's own custom rows (RLS), so the glaze cache is
// keyed by user id and invalidated on createGlaze/updateGlaze. Persisted to
// localStorage so the catalog survives reloads of this home-screen PWA — this
// data essentially never changes, so re-fetching it on every Catalog mount and
// every PieceDetail glaze load is pure waste.
// Shape: { clay: { rows, expiresAt }, glaze: { [userId]: { rows, expiresAt } } }
const CATALOG_CACHE_KEY = 'potheads_catalog_cache'
const CATALOG_TTL_MS = 24 * 60 * 60 * 1000 // 24h

const catalogCache = loadCatalogCache()

function loadCatalogCache() {
  const base = { clay: null, glaze: {} }
  try {
    const raw = localStorage.getItem(CATALOG_CACHE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        base.clay = parsed.clay || null
        base.glaze = parsed.glaze || {}
      }
    }
  } catch { /* corrupt/unavailable storage — start empty */ }
  return base
}

let persistTimer = null
function persistCatalogCache() {
  if (persistTimer) return // debounce bursts into one write
  persistTimer = setTimeout(() => {
    persistTimer = null
    try {
      localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(catalogCache))
    } catch { /* quota/unavailable — cache stays in-memory only */ }
  }, 500)
}

function freshEntry(entry) {
  return entry && entry.expiresAt > Date.now() ? entry.rows : null
}

export async function listClayBodies() {
  const cached = freshEntry(catalogCache.clay)
  if (cached) {
    recordCache('catalog', { hit: true })
    return cached
  }
  recordCache('catalog', { hit: false })
  const { data, error } = await supabase
    .from('clay_bodies')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  catalogCache.clay = { rows: data, expiresAt: Date.now() + CATALOG_TTL_MS }
  persistCatalogCache()
  return data
}

// userId keys the cache so one browser shared by multiple accounts never serves
// another user's custom glazes. Falls back to 'anon' when unknown (still correct —
// it just caches the global-only result under its own key).
export async function listGlazes(userId) {
  const key = userId || 'anon'
  const cached = freshEntry(catalogCache.glaze[key])
  if (cached) {
    recordCache('catalog', { hit: true })
    return cached
  }
  recordCache('catalog', { hit: false })
  const { data, error } = await supabase
    .from('glazes')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  catalogCache.glaze[key] = { rows: data, expiresAt: Date.now() + CATALOG_TTL_MS }
  persistCatalogCache()
  return data
}

// Drop cached glaze rows after a custom-glaze write so the next list refetches.
function invalidateGlazeCache() {
  catalogCache.glaze = {}
  persistCatalogCache()
}

export function clearCatalogCache() {
  catalogCache.clay = null
  catalogCache.glaze = {}
  try { localStorage.removeItem(CATALOG_CACHE_KEY) } catch { /* ignore */ }
}

export function getCatalogCacheStats() {
  const clayFresh = !!freshEntry(catalogCache.clay)
  const glazeKeys = Object.keys(catalogCache.glaze).filter((k) => freshEntry(catalogCache.glaze[k]))
  return {
    clayCached: clayFresh,
    clayRows: clayFresh ? catalogCache.clay.rows.length : 0,
    glazeUsers: glazeKeys.length,
    glazeRows: glazeKeys.reduce((n, k) => n + catalogCache.glaze[k].rows.length, 0),
  }
}

// Case-insensitive name → glaze lookup so free-text glaze tags (stored
// lowercased, e.g. "pete's cranberry") resolve to their catalog row
// ("Pete's Cranberry"). Duplicate names tie-break deterministically by slug.
export function buildGlazeIndex(glazes) {
  const sorted = [...(glazes || [])].sort((a, b) =>
    (a.slug || '').localeCompare(b.slug || '')
  )
  const map = new Map()
  for (const g of sorted) {
    const key = (g.name || '').trim().toLowerCase()
    if (key && !map.has(key)) map.set(key, g)
  }
  return map
}

export function matchGlaze(index, tagName) {
  if (!index || !tagName) return null
  return index.get(tagName.trim().toLowerCase()) || null
}

// Case-insensitive name → clay body lookup, mirroring buildGlazeIndex/matchGlaze.
// Lets a piece's free-text clay_body resolve to its catalog row for the detail view.
export function buildClayIndex(clays) {
  const sorted = [...(clays || [])].sort((a, b) =>
    (a.slug || '').localeCompare(b.slug || '')
  )
  const map = new Map()
  for (const c of sorted) {
    const key = (c.name || '').trim().toLowerCase()
    if (key && !map.has(key)) map.set(key, c)
  }
  return map
}

export function matchClay(index, name) {
  if (!index || !name) return null
  return index.get(name.trim().toLowerCase()) || null
}

const GLAZE_EDITABLE_FIELDS = ['name', 'finish', 'family', 'base_color', 'hex_swatch', 'food_safe', 'notes']

function slugifyGlaze(name) {
  const base = (name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  // Suffix keeps the global unique(slug) constraint happy across users.
  return `${base || 'glaze'}-${crypto.randomUUID().slice(0, 8)}`
}

// Creates a user-scoped custom glaze (user_id = userId). Requires migration 003.
export async function createGlaze(userId, fields) {
  const row = { user_id: userId, slug: slugifyGlaze(fields.name) }
  for (const k of GLAZE_EDITABLE_FIELDS) {
    if (fields[k] !== undefined) row[k] = fields[k]
  }
  row.name = (fields.name || '').trim()
  const { data, error } = await supabase
    .from('glazes')
    .insert(row)
    .select()
    .single()
  if (error) throw error
  invalidateGlazeCache()
  return data
}

// Updates a custom glaze (RLS allows only the owner's own rows).
export async function updateGlaze(glazeId, fields) {
  const patch = {}
  for (const k of GLAZE_EDITABLE_FIELDS) {
    if (fields[k] !== undefined) patch[k] = fields[k]
  }
  const { data, error } = await supabase
    .from('glazes')
    .update(patch)
    .eq('id', glazeId)
    .select()
    .single()
  if (error) throw error
  invalidateGlazeCache()
  return data
}

export async function listClayFavorites(userId) {
  const { data, error } = await supabase
    .from('user_clay_favorites')
    .select('clay_body_id')
    .eq('user_id', userId)
  if (error) throw error
  return new Set(data.map((r) => r.clay_body_id))
}

export async function listGlazeFavorites(userId) {
  const { data, error } = await supabase
    .from('user_glaze_favorites')
    .select('glaze_id')
    .eq('user_id', userId)
  if (error) throw error
  return new Set(data.map((r) => r.glaze_id))
}

export async function toggleClayFavorite(userId, clayBodyId, on) {
  if (on) {
    const { error } = await supabase
      .from('user_clay_favorites')
      .insert({ user_id: userId, clay_body_id: clayBodyId })
    if (error && error.code !== '23505') throw error
  } else {
    const { error } = await supabase
      .from('user_clay_favorites')
      .delete()
      .match({ user_id: userId, clay_body_id: clayBodyId })
    if (error) throw error
  }
}

export async function toggleGlazeFavorite(userId, glazeId, on) {
  if (on) {
    const { error } = await supabase
      .from('user_glaze_favorites')
      .insert({ user_id: userId, glaze_id: glazeId })
    if (error && error.code !== '23505') throw error
  } else {
    const { error } = await supabase
      .from('user_glaze_favorites')
      .delete()
      .match({ user_id: userId, glaze_id: glazeId })
    if (error) throw error
  }
}
