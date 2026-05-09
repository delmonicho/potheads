import { memo } from 'react'
import HeartButton from './HeartButton.jsx'

function ClayCard({ clay, favorite, onToggleFavorite, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(clay)}
      className="relative flex flex-col bg-white rounded-2xl overflow-hidden border border-stone-200 cursor-pointer hover:border-clay/40 hover:shadow-sm active:scale-[0.99] transition-all text-left"
    >
      <div
        className="aspect-square w-full"
        style={{ backgroundColor: clay.hex_swatch || '#d4c5b0' }}
      />
      <div className="absolute top-2 right-2">
        <div className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center">
          <HeartButton favorite={favorite} onToggle={(on) => onToggleFavorite(clay.id, on)} size={18} />
        </div>
      </div>
      <div className="p-3 flex flex-col gap-1.5">
        <div>
          <p className="text-sm font-semibold text-ink leading-tight">{clay.name}</p>
          {clay.manufacturer && (
            <p className="text-[11px] text-muted">{clay.manufacturer}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {clay.texture && (
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-stone-100 text-muted">
              {clay.texture}
            </span>
          )}
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-clay/10 text-clay">
            {clay.category}
          </span>
        </div>
      </div>
    </button>
  )
}

export default memo(ClayCard)
