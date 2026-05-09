import { memo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { STAGE_LABELS } from '../lib/pieces.js'
import PotteryPlaceholder from './PotteryPlaceholder.jsx'

export const PieceCard = memo(function PieceCard({ piece, thumbUrl, formTag, selectMode, selected, onToggleSelect }) {
  const navigate = useNavigate()
  const [imgLoaded, setImgLoaded] = useState(false)

  function handleTap() {
    if (selectMode) {
      onToggleSelect(piece.id)
    } else {
      navigate(`/piece/${piece.id}`)
    }
  }

  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden bg-surface-raised border border-line shadow-sm hover:shadow-md transition-shadow active:opacity-90 cursor-pointer relative"
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
        ) : (
          <PotteryPlaceholder formTag={formTag} />
        )}
      </div>

      {/* Selection overlay */}
      {selectMode && (
        <div className={`absolute inset-0 rounded-2xl transition-colors ${selected ? 'bg-clay/20' : ''}`}>
          <div className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
            selected
              ? 'bg-clay border-clay'
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
      <div className="px-3 py-2.5 bg-surface-raised">
        <p className="text-sm font-semibold text-ink truncate leading-snug">{piece.name}</p>
        {formTag && (
          <p className="text-[10px] uppercase tracking-widest text-muted mt-1 truncate">{formTag}</p>
        )}
      </div>
    </div>
  )
})

export default memo(function StageColumn({ stage, pieces, thumbUrls, formTags, selectMode, selectedIds, onToggleSelect }) {
  if (!pieces || pieces.length === 0) return null

  return (
    <div className="mb-8">
      <div className="flex items-baseline justify-between mb-3 border-b border-stone-200 pb-2">
        <h2 className="font-display italic text-2xl text-ink">
          {STAGE_LABELS[stage]}
        </h2>
        <span className="text-sm text-muted tabular-nums">
          {String(pieces.length).padStart(2, '0')}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {pieces.map((piece) => (
          <PieceCard
            key={piece.id}
            piece={piece}
            thumbUrl={thumbUrls?.[piece.id] ?? null}
            formTag={formTags?.[piece.id] ?? null}
            selectMode={selectMode}
            selected={selectedIds?.has(piece.id) ?? false}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>
    </div>
  )
})
