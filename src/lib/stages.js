import { supabase } from './supabase.js'

export async function getCustomStages(userId) {
  const { data, error } = await supabase
    .from('custom_stages')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createCustomStage(userId, name) {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Stage name is required')
  const { data, error } = await supabase
    .from('custom_stages')
    .insert({ user_id: userId, name: trimmed })
    .select()
    .single()
  if (error) {
    if (error.code === '23505') throw new Error(`"${trimmed}" already exists`)
    throw error
  }
  return data
}

export async function deleteCustomStage(id) {
  const { error } = await supabase
    .from('custom_stages')
    .delete()
    .eq('id', id)
  if (error) throw error
}
