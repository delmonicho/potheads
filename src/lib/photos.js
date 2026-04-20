import imageCompression from 'browser-image-compression'
import { supabase } from './supabase.js'

const COMPRESSION_OPTIONS = {
  maxWidthOrHeight: 1600,
  initialQuality: 0.8,
  useWebWorker: true,
}

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

export async function getPhotoUrl(path) {
  const { data, error } = await supabase.storage
    .from('photos')
    .createSignedUrl(path, 3600)

  if (error) throw error
  return data.signedUrl
}

export async function updatePhotoStage(photoId, stage) {
  const { error } = await supabase
    .from('photos')
    .update({ stage })
    .eq('id', photoId)
  if (error) throw error
}
