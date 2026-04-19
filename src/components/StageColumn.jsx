import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { STAGE_LABELS } from '../lib/pieces.js'
import { getPhotosForPiece, getPhotoUrl } from '../lib/photos.js'
import { getTagsForPiece } from '../lib/tags.js'
import PotteryPlaceholder from './PotteryPlaceholder.jsx'

function PieceCard({ piece, selectMode, selected, onToggleSelect }) {
  const navigate = useNavigate()
  const [thumbUrl, setThumbUrl] = useState(null)
  const [photoLoading, setPhotoLoading] = useState(true)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [formTag, setFormTag] = useState(null)

  useEffect(() => {
    getPhotosForPiece(piece.id).then(async (photos) => {
      if (photos.length > 0) {
        const url = await getPhotoUrl(photos[photos.length - 1].storage_path)
        setThumbUrl(url)
      }
      setPhotoLoading(false)
    }).catch(() => { setPhotoLoading(false) })

    getTagsForPiece(piece.id).then((tags) => {
      const ft = tags.find((t) => t.category === 'form')
      if (ft) setFormTag(ft.name)
    }).catch(() => {})
  }, [piece.id])

  function handleTap() {
    if (selectMode) {
      onToggleSelect(piece.id)
    } else {
      navigate(`/piece/${piece.id}`)
    }
  }

  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden active:opacity-75 cursor-pointer relative"
      onClick={handleTap}
    >
      {/* Square photo thumbnail */}
      <div className="aspect-square bg-tan overflow-hidden">
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt=""
            className={`w-full h-full object-cover transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImgLoaded(true)}
          />
        ) : !photoLoading ? (
          <PotteryPlaceholder formTag={formTag} />
        ) : null}
      </div>

      {/* Selection overlay */}
      {selectMode && (
        <div className={`absolute inset-0 rounded-2xl transition-colors ${selected ? 'bg-[#78350f]/20' : ''}`}>
          <div className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
            selected
              ? 'bg-[#78350f] border-[#78350f]'
              : 'bg-white/70 border-white'
          }`}>
            {selected && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="2 6 5 9 10 3" />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Card footer */}
      <div className="px-1.5 py-1.5 bg-[#fafaf9]">
        <p className="text-xs font-semibold text-[#1c1917] truncate leading-snug">{piece.name}</p>
        {formTag && (
          <p className="text-[9px] uppercase tracking-widest text-stone-400 mt-0.5 truncate">{formTag}</p>
        )}
      </div>
    </div>
  )
}

export default function StageColumn({ stage, pieces, selectMode, selectedIds, onToggleSelect }) {
  if (!pieces || pieces.length === 0) return null

  return (
    <div className="mb-8">
      <div className="flex items-baseline justify-between mb-3 border-b border-stone-200 pb-2">
        <h2 className="font-display italic text-2xl text-[#1c1917]">
          {STAGE_LABELS[stage]}
        </h2>
        <span className="text-sm text-stone-400 tabular-nums">
          {String(pieces.length).padStart(2, '0')}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {pieces.map((piece) => (
          <PieceCard
            key={piece.id}
            piece={piece}
            selectMode={selectMode}
            selected={selectedIds?.has(piece.id) ?? false}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>
    </div>
  )
}
