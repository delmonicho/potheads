import { supabase } from './supabase.js'

export const PRESET_TAGS = {
  form: ['bowl', 'mug', 'cup', 'plate', 'vase', 'planter', 'pitcher', 'teapot', 'tile'],
  glaze: ['celadon', 'shino', 'tenmoku', 'ash', 'copper', 'cobalt', 'iron oxide'],
}

export async function getOrCreateTag(name, category, userId) {
  const { data: existing } = await supabase
    .from('tags')
    .select('id')
    .eq('name', name)
    .eq('category', category)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) return existing.id

  const { data, error } = await supabase
    .from('tags')
    .insert({ name, category, user_id: userId })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

export async function getTagsForPiece(pieceId) {
  const { data, error } = await supabase
    .from('piece_tags')
    .select('tag_id, tags(id, name, category)')
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
    .select('id, name, category')
    .eq('user_id', userId)

  if (error) throw error
  return data
}
