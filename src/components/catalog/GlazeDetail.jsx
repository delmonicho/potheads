import HeartButton from './HeartButton.jsx'
import SwatchInfo from './SwatchInfo.jsx'

function Field({ label, value }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-widest text-muted">{label}</span>
      <span className="text-sm text-ink">{value}</span>
    </div>
  )
}

export default function GlazeDetail({ glaze, favorite, onToggleFavorite }) {
  if (!glaze) return null

  return (
    <div className="flex flex-col gap-4 pb-2">
      <div className="flex items-start gap-4">
        <div
          className="w-24 h-24 rounded-2xl shrink-0 border border-stone-200"
          style={{ backgroundColor: glaze.hex_swatch || '#d4c5b0' }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-ink leading-tight">{glaze.name}</h3>
              {glaze.family && (
                <p className="text-sm text-muted mt-0.5">{glaze.family}</p>
              )}
            </div>
            <HeartButton favorite={favorite} onToggle={(on) => onToggleFavorite(glaze.id, on)} size={26} />
          </div>
          <div className="flex items-center gap-1 mt-2">
            <span className="text-[10px] uppercase tracking-widest text-muted">Approx. fired color</span>
            <SwatchInfo />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {glaze.finish && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-stage-complete/10 text-stage-complete">
            {glaze.finish}
          </span>
        )}
        {glaze.food_safe ? (
          <span className="text-xs px-2.5 py-1 rounded-full bg-green-50 text-green-800">
            food safe
          </span>
        ) : (
          <span className="text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-700">
            not food safe
          </span>
        )}
        {glaze.reactive && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
            reactive
          </span>
        )}
        {glaze.layers_well && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-stone-100 text-muted">
            layers well
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Base color" value={glaze.base_color} />
        <Field label="Cone" value={glaze.cone} />
        <Field label="Atmosphere" value={glaze.atmosphere} />
        <Field label="Application" value={glaze.application} />
      </div>

      {glaze.notes && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest text-muted">Notes</span>
          <p className="text-sm text-ink leading-relaxed whitespace-pre-line">{glaze.notes}</p>
        </div>
      )}

      {glaze.source_url && (
        <a
          href={glaze.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-clay hover:text-clay-dark underline self-start cursor-pointer"
        >
          View on The Pottery Studio →
        </a>
      )}
    </div>
  )
}
