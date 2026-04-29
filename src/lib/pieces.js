import { supabase } from './supabase.js'

export const STAGES = ['drying', 'bisque_ready', 'glazed', 'finished']

export const STAGE_LABELS = {
  drying: 'Drying',
  bisque_ready: 'Bisque Ready',
  glazed: 'Glazed',
  finished: 'Finished',
}

export function nextStage(current) {
  const idx = STAGES.indexOf(current)
  return idx >= 0 && idx < STAGES.length - 1 ? STAGES[idx + 1] : null
}

export async function getPieces(userId) {
  const { data, error } = await supabase
    .from('pieces')
    .select('*')
    .eq('user_id', userId)
    .eq('lost', false)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function addPiece({ userId, name, clayBody, stage = 'drying' }) {
  const { data, error } = await supabase
    .from('pieces')
    .insert({ user_id: userId, name, clay_body: clayBody || null, current_stage: stage, lost: false })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateStage(pieceId, stage) {
  const { error } = await supabase
    .from('pieces')
    .update({ current_stage: stage })
    .eq('id', pieceId)

  if (error) throw error
}

export async function advanceStage(pieceId, stage, notes) {
  const [{ error: updateError }, { error: eventError }] = await Promise.all([
    supabase.from('pieces').update({ current_stage: stage }).eq('id', pieceId),
    supabase.from('stage_events').insert({ piece_id: pieceId, stage, notes: notes || null }),
  ])
  if (updateError) throw updateError
  if (eventError) throw eventError
}

export async function getStageEvents(pieceId) {
  try {
    const { data, error } = await supabase
      .from('stage_events')
      .select('*')
      .eq('piece_id', pieceId)
      .order('moved_at', { ascending: true })
    if (error) throw error
    return data ?? []
  } catch (err) {
    console.warn('getStageEvents failed, returning []:', err.message)
    return []
  }
}

export async function markLost(pieceId) {
  const { error } = await supabase
    .from('pieces')
    .update({ lost: true })
    .eq('id', pieceId)

  if (error) throw error
}
