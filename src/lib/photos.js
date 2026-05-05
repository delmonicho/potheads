import imageCompression from 'browser-image-compression'
import { supabase } from './supabase.js'

const COMPRESSION_OPTIONS = {
  maxWidthOrHeight: 1600,
  initialQuality: 0.8,
  useWebWorker: true,
}

// Module-level signed URL cache — avoids regenerating URLs within their 1-hour validity
const urlCache = new Map() // path → { url, expiresAt }

function isHeicFile(file) {
  const name = file.name.toLowerCase()
  return file.type === 'image/heic' || file.type === 'image/heif'
    || name.endsWith('.heic') || name.endsWith('.heif')
}

// Decode HEIC to JPEG via canvas — works on iOS Safari which natively decodes HEIC.
// Returns a Blob on success, null if the browser can't decode it.
function heicToJpeg(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
      canvas.toBlob(blob => { URL.revokeObjectURL(url); resolve(blob) }, 'image/jpeg', 0.9)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    img.src = url
  })
}

export async function uploadPhoto({ file, userId, pieceId, stage, note }) {
  let uploadFile = file
  let contentType = 'image/jpeg'

  if (isHeicFile(file)) {
    const jpeg = await heicToJpeg(file)
    if (jpeg) {
      uploadFile = await imageCompression(jpeg, COMPRESSION_OPTIONS)
    } else {
      // Browser can't decode HEIC (e.g. desktop Chrome) — upload raw
      uploadFile = file
      contentType = file.type || 'image/heic'
    }
  } else {
    uploadFile = await imageCompression(file, COMPRESSION_OPTIONS)
  }

  const ext = contentType === 'image/jpeg' ? 'jpg' : file.name.split('.').pop() || 'heic'
  const path = `${userId}/${pieceId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('photos')
    .upload(path, uploadFile, { contentType })

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

// Hard-delete a photo: DB row first (source of truth), then storage object.
// If storage removal fails the row is already gone — orphan is harmless and the user is unblocked.
export async function deletePhoto(photoId, storagePath) {
  const { error: dbErr } = await supabase
    .from('photos')
    .delete()
    .eq('id', photoId)
  if (dbErr) throw dbErr

  if (storagePath) {
    const { error: stErr } = await supabase.storage
      .from('photos')
      .remove([storagePath])
    if (stErr) console.warn('Storage delete failed (orphan left):', stErr.message)
    urlCache.delete(storagePath)
  }
}
