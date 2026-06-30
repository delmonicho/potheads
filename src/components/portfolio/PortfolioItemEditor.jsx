import { useState } from 'react'
import BottomSheet from '../BottomSheet.jsx'

const STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'sold', label: 'Sold' },
  { value: 'nfs', label: 'NFS' },
]

// Edits the curated museum-label fields of one showcased portfolio_item. These
// are denormalized overrides — editing them never touches the piece/tags.
// Caller should key this `key={item.id}` so state resets per item (BottomSheet
// keeps children mounted).
export default function PortfolioItemEditor({ open, onClose, item, onSave, saving, error }) {
  const glazesToText = (glazes) =>
    Array.isArray(glazes) ? glazes.map((g) => g?.name).filter(Boolean).join(', ') : ''

  const [title, setTitle] = useState(item?.title || '')
  const [year, setYear] = useState(item?.year || '')
  const [form, setForm] = useState(item?.form || '')
  const [clayBody, setClayBody] = useState(item?.clay_body || '')
  const [glazes, setGlazes] = useState(glazesToText(item?.glazes))
  const [firing, setFiring] = useState(item?.firing || '')
  const [dimensions, setDimensions] = useState(item?.dimensions || '')
  const [status, setStatus] = useState(item?.status || 'nfs')
  const [showProcess, setShowProcess] = useState(item?.show_process ?? false)

  function handleSave() {
    // Preserve existing hex per glaze name; new names get null.
    const hexByName = new Map(
      (Array.isArray(item?.glazes) ? item.glazes : []).map((g) => [g?.name, g?.hex || null])
    )
    const glazeList = glazes
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => ({ name, hex: hexByName.get(name) ?? null }))

    onSave({
      title: title.trim() || null,
      year: year.trim() || null,
      form: form.trim() || null,
      clay_body: clayBody.trim() || null,
      glazes: glazeList.length ? glazeList : null,
      firing: firing.trim() || null,
      dimensions: dimensions.trim() || null,
      status,
      show_process: showProcess,
    })
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Edit label">
      <div className="flex flex-col gap-4 pb-2">
        <Field label="Title"><Input value={title} onChange={setTitle} placeholder="Untitled" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Year"><Input value={year} onChange={setYear} placeholder="2026" /></Field>
          <Field label="Form"><Input value={form} onChange={setForm} placeholder="bowl" /></Field>
        </div>
        <Field label="Clay body"><Input value={clayBody} onChange={setClayBody} placeholder="e.g. Speckled stoneware" /></Field>
        <Field label="Glazes (comma-separated)"><Input value={glazes} onChange={setGlazes} placeholder="celadon, shino" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Firing"><Input value={firing} onChange={setFiring} placeholder="Cone 10 reduction" /></Field>
          <Field label="Dimensions"><Input value={dimensions} onChange={setDimensions} placeholder='4 × 6 in' /></Field>
        </div>

        <Field label="Status">
          <div className="flex gap-2">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatus(opt.value)}
                className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium cursor-pointer transition-colors ${
                  status === opt.value
                    ? 'bg-clay text-white'
                    : 'border border-line-strong text-ink-soft hover:bg-surface-warm-hover'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Field>

        <button
          onClick={() => setShowProcess((v) => !v)}
          className="flex items-center justify-between cursor-pointer hover:opacity-80"
        >
          <span className="text-sm text-ink">Show making-of process</span>
          <span className={`relative w-11 h-6 rounded-full transition-colors ${showProcess ? 'bg-clay' : 'bg-line-strong'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${showProcess ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </span>
        </button>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-clay text-white font-semibold py-3.5 rounded-2xl cursor-pointer hover:bg-clay-dark disabled:opacity-50 mt-1"
        >
          {saving ? 'Saving…' : 'Save label'}
        </button>
      </div>
    </BottomSheet>
  )
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-widest text-muted">{label}</span>
      {children}
    </label>
  )
}

function Input({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-sm bg-surface-warm rounded-lg px-3 py-2 text-ink focus:outline-none"
    />
  )
}
