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

export async function updatePiece(pieceId, { name, clayBody, currentStage } = {}) {
  const updates = {}
  if (name !== undefined) updates.name = name
  if (clayBody !== undefined) updates.clay_body = clayBody || null
  if (currentStage !== undefined) updates.current_stage = currentStage
  if (Object.keys(updates).length === 0) return

  const { error } = await supabase
    .from('pieces')
    .update(updates)
    .eq('id', pieceId)

  if (error) throw error
}

export async function getPieceIds(userId) {
  const { data, error } = await supabase
    .from('pieces')
    .select('id')
    .eq('user_id', userId)
    .eq('lost', false)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data.map((row) => row.id)
}

export async function getPiecesByIds(ids) {
  const filtered = ids.filter(Boolean)
  if (!filtered.length) return new Map()
  const { data, error } = await supabase
    .from('pieces')
    .select('id, name, clay_body')
    .in('id', filtered)
  if (error) throw error
  return data.reduce((map, row) => {
    map.set(row.id, row)
    return map
  }, new Map())
}

export async function upsertStageNote(pieceId, stage, notes, fallbackMovedAt = null) {
  const trimmed = notes ? notes.trim() : ''
  const value = trimmed.length ? trimmed : null

  const { data: existing, error: selectError } = await supabase
    .from('stage_events')
    .select('id')
    .eq('piece_id', pieceId)
    .eq('stage', stage)
    .order('moved_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (selectError) throw selectError

  if (existing) {
    const { error } = await supabase
      .from('stage_events')
      .update({ notes: value })
      .eq('id', existing.id)
    if (error) throw error
    return
  }

  const insert = { piece_id: pieceId, stage, notes: value }
  if (fallbackMovedAt) insert.moved_at = fallbackMovedAt
  const { error: insertError } = await supabase.from('stage_events').insert(insert)
  if (insertError) throw insertError
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
