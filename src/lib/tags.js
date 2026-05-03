import { supabase } from './supabase.js'

export const PRESET_TAGS = {
  form: ['bowl', 'mug', 'cup', 'plate', 'vase', 'planter', 'pitcher', 'teapot', 'tile'],
  glaze: [],
}

export async function getOrCreateTag(name, category, userId, color) {
  const { data: existing } = await supabase
    .from('tags')
    .select('id, color')
    .eq('name', name)
    .eq('category', category)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    if (color && color !== existing.color) {
      await supabase.from('tags').update({ color }).eq('id', existing.id)
    }
    return existing.id
  }

  const { data, error } = await supabase
    .from('tags')
    .insert({ name, category, user_id: userId, color: color || null })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

export async function getTagsForPieces(pieceIds) {
  if (!pieceIds.length) return new Map()
  const { data, error } = await supabase
    .from('piece_tags')
    .select('piece_id, tags(id, name, category, color)')
    .in('piece_id', pieceIds)
  if (error) throw error
  return data.reduce((map, row) => {
    if (!map.has(row.piece_id)) map.set(row.piece_id, [])
    map.get(row.piece_id).push(row.tags)
    return map
  }, new Map())
}

export async function getTagsForPiece(pieceId) {
  const { data, error } = await supabase
    .from('piece_tags')
    .select('tag_id, tags(id, name, category, color)')
    .eq('piece_id', pieceId)

  if (error) throw error
  return data.map((row) => row.tags)
}

export async function addTagToPiece(pieceId, tagId) {
  const { error } = await supabase
    .from('piece_tags')
    .upsert({ piece_id: pieceId, tag_id: tagId }, { ignoreDuplicates: true })

  if (error) throw error
}

export async function removeTagFromPiece(pieceId, tagId) {
  const { error } = await supabase
    .from('piece_tags')
    .delete()
    .eq('piece_id', pieceId)
    .eq('tag_id', tagId)

  if (error) throw error
}

export async function getUserTags(userId) {
  const { data, error } = await supabase
    .from('tags')
    .select('id, name, category, color')
    .eq('user_id', userId)

  if (error) throw error
  return data
}

export async function updateTagColor(tagId, color) {
  const { error } = await supabase.from('tags').update({ color }).eq('id', tagId)
  if (error) throw error
}
