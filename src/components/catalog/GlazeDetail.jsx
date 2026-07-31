import { useState } from 'react'
import HeartButton from './HeartButton.jsx'
import SwatchInfo from './SwatchInfo.jsx'

const FINISHES = ['glossy', 'satin', 'matte', 'textural', 'other']

function Field({ label, value }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-widest text-muted">{label}</span>
      <span className="text-sm text-ink">{value}</span>
    </div>
  )
}

function GlazeForm({ glaze, saving, error, onSave, onCancel }) {
  const [name, setName] = useState(glaze.name || '')
  const [hex, setHex] = useState(glaze.hex_swatch || '#4a7c59')
  const [finish, setFinish] = useState(glaze.finish || '')
  const [family, setFamily] = useState(glaze.family || '')
  const [baseColor, setBaseColor] = useState(glaze.base_color || '')
  const [cone, setCone] = useState(glaze.cone || '')
  const [foodSafe, setFoodSafe] = useState(glaze.food_safe ?? true)
  const [notes, setNotes] = useState(glaze.notes || '')

  const trimmed = name.trim()

  function handleSave() {
    if (!trimmed) return
    onSave({
      name: trimmed,
      hex_swatch: hex,
      finish: finish || null,
      family: family.trim() || null,
      base_color: baseColor.trim() || null,
      cone: cone.trim() || null,
      food_safe: foodSafe,
      notes: notes.trim() || null,
    })
  }

  return (
    <div className="flex flex-col gap-4 pb-2">
      <div>
        <label className="block text-xs uppercase tracking-widest text-muted mb-1.5">Name</label>
        <input
          className="w-full border border-line rounded-xl px-3 py-2.5 text-sm bg-surface-warm text-ink"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-widest text-muted mb-2">Swatch color</label>
        <div className="flex items-center gap-3">
          <label className="relative cursor-pointer flex-shrink-0">
            <div
              className="w-11 h-11 rounded-full border-2 border-line shadow-inner"
              style={{ backgroundColor: hex }}
            />
            <input
              type="color"
              value={hex}
              onChange={(e) => setHex(e.target.value)}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            />
          </label>
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted">Approximate fired color</span>
            <SwatchInfo />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-widest text-muted mb-2">Finish</label>
        <div className="flex flex-wrap gap-2">
          {FINISHES.map((f) => (
            <button
              key={f}
              onClick={() => setFinish((prev) => (prev === f ? '' : f))}
              className={`px-3 py-1 rounded-full border text-sm capitalize cursor-pointer transition-colors ${
                finish === f
                  ? 'bg-stage-complete border-stage-complete text-white'
                  : 'border-line-strong text-ink-soft hover:bg-surface-warm-hover'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted mb-1.5">Family</label>
          <input
            className="w-full border border-line rounded-xl px-3 py-2 text-sm bg-surface-warm text-ink"
            placeholder="e.g. celadon"
            value={family}
            onChange={(e) => setFamily(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted mb-1.5">Base color</label>
          <input
            className="w-full border border-line rounded-xl px-3 py-2 text-sm bg-surface-warm text-ink"
            placeholder="e.g. soft blue-grey"
            value={baseColor}
            onChange={(e) => setBaseColor(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted mb-1.5">Cone</label>
          <input
            className="w-full border border-line rounded-xl px-3 py-2 text-sm bg-surface-warm text-ink"
            placeholder="e.g. 6, 06, 10"
            value={cone}
            onChange={(e) => setCone(e.target.value)}
          />
        </div>
      </div>

      <button
        onClick={() => setFoodSafe((v) => !v)}
        className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl border border-line bg-surface-warm cursor-pointer hover:bg-surface-warm-hover"
      >
        <span className="text-sm text-ink">Food safe</span>
        <span className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors ${foodSafe ? 'bg-stage-complete' : 'bg-stage-pending'}`}>
          <span className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${foodSafe ? 'translate-x-4' : ''}`} />
        </span>
      </button>

      <div>
        <label className="block text-xs uppercase tracking-widest text-muted mb-1.5">Notes</label>
        <textarea
          className="w-full border border-line rounded-xl px-3 py-2 text-sm bg-surface-warm text-ink resize-none"
          rows={3}
          placeholder="Firing notes, application, etc."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error && <p className="text-red-500 text-xs text-center">{error}</p>}

      <button
        onClick={handleSave}
        disabled={!trimmed || saving}
        className="w-full bg-clay text-white font-semibold py-3 rounded-2xl active:bg-clay-dark disabled:opacity-40 cursor-pointer hover:bg-clay-dark"
      >
        {saving ? 'Saving…' : 'Save glaze'}
      </button>
      <button
        onClick={onCancel}
        disabled={saving}
        className="w-full text-muted font-semibold py-2 cursor-pointer hover:text-ink-soft disabled:opacity-40"
      >
        Cancel
      </button>
    </div>
  )
}

export default function GlazeDetail({ glaze, favorite, onToggleFavorite, editable = false, onSave, saving = false, saveError = null }) {
  const [editing, setEditing] = useState(false)
  if (!glaze) return null

  async function handleSave(fields) {
    try {
      await onSave(fields)
      setEditing(false)
    } catch {
      // error is surfaced to the user via saveError; stay in edit mode
    }
  }

  if (editing) {
    return (
      <GlazeForm
        glaze={glaze}
        saving={saving}
        error={saveError}
        onSave={handleSave}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4 pb-2">
      <div className="flex items-start gap-4">
        <div
          className="w-24 h-24 rounded-2xl shrink-0 border border-line"
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
          <span className="text-xs px-2.5 py-1 rounded-full bg-surface-warm text-muted">
            layers well
          </span>
        )}
        {glaze.user_id && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-clay/10 text-clay">
            custom
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

      {editable && (
        <button
          onClick={() => setEditing(true)}
          className="w-full mt-1 border border-line text-ink-soft font-semibold py-2.5 rounded-2xl cursor-pointer hover:bg-surface-warm-hover"
        >
          Edit glaze
        </button>
      )}
    </div>
  )
}
