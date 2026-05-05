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
