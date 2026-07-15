import { memo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { STAGE_LABELS, STAGE_COLORS, fmtStageDate } from '../lib/pieces.js'
import { CATEGORY_DEFAULTS } from '../lib/useTagColors.js'
import PotteryPlaceholder from './PotteryPlaceholder.jsx'

function SparkleIcon({ className = '', size = 13 }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size} className={className} aria-hidden="true">
      <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" />
    </svg>
  )
}

function ChevronIcon({ className = '', size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width={size} height={size} className={className} aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

export const PieceCard = memo(function PieceCard({ piece, thumbUrl, formTag, glazeTag, stageDate, selectMode, selected, onToggleSelect }) {
  const navigate = useNavigate()
  const [imgLoaded, setImgLoaded] = useState(false)

  function handleTap() {
    if (selectMode) {
      onToggleSelect(piece.id)
    } else {
      navigate(`/piece/${piece.id}`)
    }
  }

  // "Celebrated" = truly finished and still on the shelf (not lost) — a
  // finished piece later tagged lost falls back to the plain stage tint.
  const isCelebrated = piece.current_stage === 'finished' && !piece.lost
  const dateLabel = piece.current_stage !== 'finished' ? fmtStageDate(stageDate) : null
  const stageColor = STAGE_COLORS[piece.current_stage] || STAGE_COLORS.drying
  // Dynamic per-piece color, so this has to be an inline style — Tailwind's
  // JIT scanner can't pick up a template-literal class name at build time.
  const tintStyle = isCelebrated ? undefined : { backgroundColor: `${stageColor}26` }

  return (
    <div
      className={`flex flex-col rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow active:opacity-90 cursor-pointer relative border ${
        isCelebrated ? 'border-gold bg-gold/12' : 'border-line'
      }`}
      style={tintStyle}
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

      {/* Finished badge — decorative, top-right so it never collides with the
          top-left selection checkbox. */}
      {isCelebrated && (
        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-gold flex items-center justify-center shadow-sm">
          <SparkleIcon className="text-white" />
        </div>
      )}

      {/* Card footer */}
      <div className="px-3 py-2.5">
        <p className="text-sm font-semibold text-ink truncate leading-snug">{piece.name}</p>
        {glazeTag ? (
          <p className="flex items-center gap-1.5 mt-1">
            <span
              className="w-2.5 h-2.5 rounded-full border border-line shrink-0"
              style={{ backgroundColor: glazeTag.color || CATEGORY_DEFAULTS.glaze }}
            />
            <span className="text-[10px] uppercase tracking-widest text-muted truncate">{glazeTag.name}</span>
            {dateLabel && <span className="text-[10px] text-muted shrink-0">· {dateLabel}</span>}
          </p>
        ) : dateLabel && (
          <p className="text-[10px] uppercase tracking-widest text-muted mt-1">{dateLabel}</p>
        )}
      </div>
    </div>
  )
})

export default memo(function StageColumn({ stage, pieces, thumbUrls, formTags, glazeTags, stageDates, selectMode, selectedIds, onToggleSelect, collapsed, onToggleCollapsed }) {
  if (!pieces || pieces.length === 0) return null
  const isFinished = stage === 'finished'

  return (
    <div className="mb-8">
      <button
        type="button"
        onClick={() => onToggleCollapsed?.(stage)}
        className={`w-full flex items-baseline justify-between mb-3 pb-2 border-b cursor-pointer hover:opacity-80 transition-opacity ${isFinished ? 'border-gold/50' : 'border-line'}`}
      >
        <h2 className="flex items-center gap-1.5 font-display italic text-2xl text-ink">
          {isFinished && <SparkleIcon size={16} className="text-gold" />}
          {STAGE_LABELS[stage]}
        </h2>
        <span className="flex items-center gap-2">
          <span className="text-sm text-muted tabular-nums">
            {String(pieces.length).padStart(2, '0')}
          </span>
          <ChevronIcon className={`text-muted transition-transform ${collapsed ? '-rotate-90' : ''}`} />
        </span>
      </button>
      {!collapsed && (
        <div className="grid grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {pieces.map((piece) => (
            <PieceCard
              key={piece.id}
              piece={piece}
              thumbUrl={thumbUrls?.[piece.id] ?? null}
              formTag={formTags?.[piece.id] ?? null}
              glazeTag={glazeTags?.[piece.id] ?? null}
              stageDate={stageDates?.[piece.id] ?? null}
              selectMode={selectMode}
              selected={selectedIds?.has(piece.id) ?? false}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
})
