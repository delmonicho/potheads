import imageCompression from 'browser-image-compression'
import { supabase } from './supabase.js'
import { recordCache } from './diagnostics.js'

const COMPRESSION_OPTIONS = {
  maxWidthOrHeight: 1600,
  initialQuality: 0.8,
  useWebWorker: true,
}

// Signed URL cache — persisted to localStorage so reloads (frequent in a PWA
// relaunched from the home screen) reuse still-valid URLs instead of re-signing
// every visible photo from scratch. Each signed URL is a single Storage API
// request, so without this the request volume scales with photos × reloads.
const URL_CACHE_KEY = 'potheads_signed_urls'
const SIGNED_URL_TTL_SECONDS = 24 * 60 * 60 // 24h; URLs live only in this private browser
const CACHE_BUFFER_MS = 5 * 60 * 1000       // re-sign 5 min before real expiry (clock skew)

// path → { url, expiresAt }
const urlCache = loadUrlCache()

function loadUrlCache() {
  const map = new Map()
  try {
    const raw = localStorage.getItem(URL_CACHE_KEY)
    if (raw) {
      const now = Date.now()
      for (const [path, entry] of Object.entries(JSON.parse(raw))) {
        if (entry && entry.expiresAt > now) map.set(path, entry)
      }
    }
  } catch { /* corrupt/unavailable storage — start empty */ }
  return map
}

let persistTimer = null
function persistUrlCache() {
  if (persistTimer) return // debounce bursts of writes into one
  persistTimer = setTimeout(() => {
    persistTimer = null
    try {
      const now = Date.now()
      const obj = {}
      for (const [path, entry] of urlCache) {
        if (entry.expiresAt > now) obj[path] = entry
      }
      localStorage.setItem(URL_CACHE_KEY, JSON.stringify(obj))
    } catch { /* quota/unavailable — cache stays in-memory only */ }
  }, 500)
}

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

// Batch-sign a list of storage paths, serving cache hits without any network
// call and signing the remaining misses in a SINGLE Storage request via
// createSignedUrls. Returns URLs aligned to the input order (null per path that
// failed). Prefer this over getPhotoUrl in a loop — it collapses N requests to 1.
export async function getPhotoUrls(paths) {
  const now = Date.now()
  const result = new Array(paths.length).fill(null)
  const missing = []
  const missingIdx = []

  paths.forEach((path, i) => {
    const cached = path && urlCache.get(path)
    if (cached && cached.expiresAt > now) {
      result[i] = cached.url
      recordCache('signedUrls', { hit: true })
    } else if (path) {
      recordCache('signedUrls', { hit: false })
      missing.push(path)
      missingIdx.push(i)
    }
  })

  if (missing.length) {
    const { data, error } = await supabase.storage
      .from('photos')
      .createSignedUrls(missing, SIGNED_URL_TTL_SECONDS)
    if (error) throw error

    const expiresAt = now + SIGNED_URL_TTL_SECONDS * 1000 - CACHE_BUFFER_MS
    const byPath = new Map(data.map((d) => [d.path, d]))
    missing.forEach((path, j) => {
      const entry = byPath.get(path)
      const url = entry && !entry.error ? entry.signedUrl : null
      if (url) urlCache.set(path, { url, expiresAt })
      result[missingIdx[j]] = url
    })
    persistUrlCache()
  }

  return result
}

export async function getPhotoUrl(path) {
  const [url] = await getPhotoUrls([path])
  return url
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
    persistUrlCache()
  }
}

// Diagnostics helpers for the /dev page.
export function getUrlCacheStats() {
  const now = Date.now()
  let fresh = 0
  for (const entry of urlCache.values()) {
    if (entry.expiresAt > now) fresh += 1
  }
  return { entries: urlCache.size, fresh }
}

export function clearUrlCache() {
  urlCache.clear()
  try { localStorage.removeItem(URL_CACHE_KEY) } catch { /* ignore */ }
}
