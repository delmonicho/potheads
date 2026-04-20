import imageCompression from 'browser-image-compression'
import { supabase } from './supabase.js'

const COMPRESSION_OPTIONS = {
  maxWidthOrHeight: 1600,
  initialQuality: 0.8,
  useWebWorker: true,
}

// Module-level signed URL cache — avoids regenerating URLs within their 1-hour validity
const urlCache = new Map() // path → { url, expiresAt }

export async function uploadPhoto({ file, userId, pieceId, stage, note }) {
  const compressed = await imageCompression(file, COMPRESSION_OPTIONS)
  const path = `${userId}/${pieceId}/${Date.now()}.jpg`

  const { error: uploadError } = await supabase.storage
    .from('photos')
    .upload(path, compressed, { contentType: 'image/jpeg' })

  if (uploadError) throw uploadError

  const { data, error: insertError } = await supabase
    .from('photos')
    .insert({ piece_id: pieceId, storage_path: path, stage: stage || null, note: note || null, taken_at: new Date().toISOString() })
    .select()
    .single()

  if (insertError) throw insertError
  return data
}

export async function getPhotosForPiece(pieceId) {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('piece_id', pieceId)
    .order('taken_at', { ascending: false })

  if (error) throw error
  return data
}

export async function getPhotosForPieces(pieceIds) {
  if (!pieceIds.length) return new Map()
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .in('piece_id', pieceIds)
    .order('taken_at', { ascending: false })
  if (error) throw error
  return data.reduce((map, photo) => {
    if (!map.has(photo.piece_id)) map.set(photo.piece_id, [])
    map.get(photo.piece_id).push(photo)
    return map
  }, new Map())
}

export async function getPhotoUrl(path) {
  const cached = urlCache.get(path)
  if (cached && cached.expiresAt > Date.now()) return cached.url

  const { data, error } = await supabase.storage
    .from('photos')
    .createSignedUrl(path, 3600)

  if (error) throw error
  urlCache.set(path, { url: data.signedUrl, expiresAt: Date.now() + 55 * 60 * 1000 })
  return data.signedUrl
}

export async function updatePhotoStage(photoId, stage) {
  const { error } = await supabase
    .from('photos')
    .update({ stage })
    .eq('id', photoId)
  if (error) throw error
}
