import { useState, useEffect, useRef } from 'react'
import { uploadPhoto, getPhotoUrl } from '../lib/photos.js'

function PhotoEntry({ photo }) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    getPhotoUrl(photo.storage_path).then(setUrl).catch(() => {})
  }, [photo.storage_path])

  const date = new Date(photo.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <div className="flex flex-col gap-1">
      <div className="w-full bg-stone-200 rounded-xl overflow-hidden aspect-[4/3]">
        {url ? (
          <img src={url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      <p className="text-xs text-stone-400 px-1">{date}</p>
      {photo.note && <p className="text-sm text-stone-600 px-1">{photo.note}</p>}
    </div>
  )
}

export default function PhotoTimeline({ photos, pieceId, userId, onPhotoAdded }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  async function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      await uploadPhoto({ file, userId, pieceId })
      onPhotoAdded()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-stone-600 uppercase tracking-wide">Photos</h2>
        <label className="text-amber-800 text-sm font-medium cursor-pointer active:opacity-70">
          {uploading ? 'Uploading…' : '+ Add photo'}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </label>
      </div>

      {error && <p className="text-red-600 text-xs mb-2">{error}</p>}

      {photos.length === 0 ? (
        <p className="text-stone-400 text-sm text-center py-8">No photos yet — add one above</p>
      ) : (
        <div className="flex flex-col gap-4">
          {photos.map((photo) => (
            <PhotoEntry key={photo.id} photo={photo} />
          ))}
        </div>
      )}
    </div>
  )
}
