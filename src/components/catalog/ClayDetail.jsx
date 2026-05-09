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

export default function ClayDetail({ clay, favorite, onToggleFavorite }) {
  if (!clay) return null
  const bestFor = Array.isArray(clay.best_for) ? clay.best_for.filter(Boolean) : []

  return (
    <div className="flex flex-col gap-4 pb-2">
      <div className="flex items-start gap-4">
        <div
          className="w-24 h-24 rounded-2xl shrink-0 border border-stone-200"
          style={{ backgroundColor: clay.hex_swatch || '#d4c5b0' }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-ink leading-tight">{clay.name}</h3>
              {clay.manufacturer && (
                <p className="text-sm text-muted mt-0.5">{clay.manufacturer}</p>
              )}
            </div>
            <HeartButton favorite={favorite} onToggle={(on) => onToggleFavorite(clay.id, on)} size={26} />
          </div>
          <div className="flex items-center gap-1 mt-2">
            <span className="text-[10px] uppercase tracking-widest text-muted">Approx. fired color</span>
            <SwatchInfo />
          </div>
        </div>
      </div>

      {bestFor.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {bestFor.map(b => (
            <span key={b} className="text-xs px-2.5 py-1 rounded-full bg-clay/10 text-clay">
              {b}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Category" value={clay.category} />
        <Field label="Texture" value={clay.texture} />
        <Field label="Color (fired)" value={clay.color_fired} />
        <Field label="Cone" value={clay.cone} />
        <Field label="Atmosphere" value={clay.atmosphere} />
        {clay.shrinkage_pct != null && <Field label="Shrinkage" value={`${clay.shrinkage_pct}%`} />}
        {clay.absorption_pct != null && <Field label="Absorption" value={`${clay.absorption_pct}%`} />}
      </div>

      {clay.notes && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest text-muted">Notes</span>
          <p className="text-sm text-ink leading-relaxed whitespace-pre-line">{clay.notes}</p>
        </div>
      )}

      {clay.image_url && (
        <img
          src={clay.image_url}
          alt={clay.name}
          loading="lazy"
          className="w-full max-h-56 object-contain rounded-xl bg-stone-50 border border-stone-200"
        />
      )}

      {clay.source_url && (
        <a
          href={clay.source_url}
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
