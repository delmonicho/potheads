import { supabase } from './supabase.js'

export async function listClayBodies() {
  const { data, error } = await supabase
    .from('clay_bodies')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return data
}

export async function listGlazes() {
  const { data, error } = await supabase
    .from('glazes')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return data
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
