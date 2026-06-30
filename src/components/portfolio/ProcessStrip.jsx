import { useState } from 'react'
import { STAGES, STAGE_LABELS } from '../../lib/pieces.js'

// Collapsible "making-of" reveal built from the piece's existing stage photos
// (drying → bisque → glazed → finished). Reads only the already-public photos on
// the item; renders nothing unless there are photos across 2+ stages.
export default function ProcessStrip({ photos, onOpenPhoto }) {
  const [open, setOpen] = useState(false)

  // One representative (earliest) photo per stage, in forward making order.
  const steps = STAGES
    .map((stage) => {
      const idx = photos.findIndex((p) => p.stage === stage)
      return idx === -1 ? null : { stage, photo: photos[idx], index: idx }
    })
    .filter(Boolean)

  if (steps.length < 2) return null

  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted cursor-pointer hover:text-ink-soft"
      >
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform ${open ? 'rotate-90' : ''}`}
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        How it was made
      </button>

      {open && (
        <div className="flex gap-3 overflow-x-auto mt-3 pb-1">
          {steps.map(({ stage, photo, index }) => (
            <button
              key={stage}
              onClick={() => onOpenPhoto(index)}
              className="shrink-0 flex flex-col gap-1.5 cursor-pointer group"
            >
              <span className="w-24 h-24 rounded-lg overflow-hidden bg-tan block">
                {photo.url && (
                  <img src={photo.url} alt="" loading="lazy" className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" />
                )}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-muted">{STAGE_LABELS[stage]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
