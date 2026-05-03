import { useState, useEffect } from 'react'
import { addPiece, getClayBodies, STAGES, STAGE_LABELS } from '../lib/pieces.js'
import { uploadPhoto } from '../lib/photos.js'
import { getOrCreateTag, addTagToPiece, PRESET_TAGS } from '../lib/tags.js'
import BottomSheet from './BottomSheet.jsx'

const FORM_TAGS = PRESET_TAGS.form

export default function AddPiece({ open, onClose, onAdded, user }) {
  const [name, setName] = useState('')
  const [clayBody, setClayBody] = useState(() => localStorage.getItem('potheads_last_clay_body') || '')
  const [stage, setStage] = useState('drying')
  const [selectedForm, setSelectedForm] = useState(null)
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [clayBodyOptions, setClayBodyOptions] = useState([])

  useEffect(() => {
    if (open) getClayBodies(user.id).then(setClayBodyOptions).catch(() => { })
  }, [open, user.id])

  function reset() {
    setName('')
    setClayBody(localStorage.getItem('potheads_last_clay_body') || '')
    setStage('drying')
    setSelectedForm(null)
    setFiles([])
    setPreviews([])
    setError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleFileChange(e) {
    const incoming = Array.from(e.target.files)
    if (!incoming.length) return
    setFiles(prev => [...prev, ...incoming])
    setPreviews(prev => [...prev, ...incoming.map(f => URL.createObjectURL(f))])
    e.target.value = ''
  }

  function removePhoto(idx) {
    setFiles(prev => prev.filter((_, i) => i !== idx))
    setPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const trimmedClay = clayBody.trim() || null
      const piece = await addPiece({ userId: user.id, name: name.trim(), clayBody: trimmedClay, stage })
      if (trimmedClay) {
        localStorage.setItem('potheads_last_clay_body', trimmedClay)
      }
      if (files.length) {
        await Promise.all(files.map(f => uploadPhoto({ file: f, userId: user.id, pieceId: piece.id, stage })))
      }
      if (selectedForm) {
        const tagId = await getOrCreateTag(selectedForm, 'form', user.id)
        await addTagToPiece(piece.id, tagId)
      }
      reset()
      onAdded(piece)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet open={open} onClose={handleClose} title="New piece">
      <div className="flex flex-col gap-5">
        {/* Photo area */}
        {previews.length === 0 ? (
          <label className="flex flex-col items-center justify-center w-full h-40 rounded-2xl bg-[#f0e8dc] cursor-pointer overflow-hidden hover:bg-[#e8ddd0] transition-colors">
            <div className="flex flex-col items-center gap-2">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#78350f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span className="font-display italic text-[#78350f] text-sm">Add photos</span>
              <span className="text-muted text-[10px] uppercase tracking-widest">Greenware · Wet</span>
            </div>
            <input type="file" accept="image/*,image/heic,image/heif" multiple className="hidden" onChange={handleFileChange} />
          </label>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-3 gap-2">
              {previews.map((src, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-stone-100">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center text-white text-sm leading-none cursor-pointer hover:bg-black/70"
                    aria-label="Remove photo"
                  >
                    ×
                  </button>
                </div>
              ))}
              <label className="aspect-square rounded-xl border-2 border-dashed border-stone-300 flex items-center justify-center cursor-pointer hover:border-stone-400 hover:bg-stone-50 transition-colors">
                <span className="text-muted text-2xl leading-none">+</span>
                <input type="file" accept="image/*,image/heic,image/heif" multiple className="hidden" onChange={handleFileChange} />
              </label>
            </div>
          </div>
        )}

        {/* Name */}
        <div>
          <label className="block text-xs uppercase tracking-widest text-stone-500 mb-1.5">Name</label>
          <input
            type="text"
            className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-[#1c1917] bg-white placeholder:text-muted"
            placeholder="e.g. Morning bowl"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Clay body */}
        <div>
          <label className="block text-xs uppercase tracking-widest text-stone-500 mb-1.5">Clay Body</label>
          <input
            type="text"
            list="clay-body-options"
            className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-[#1c1917] bg-white placeholder:text-muted"
            placeholder="e.g. Speckled buff"
            value={clayBody}
            onChange={(e) => setClayBody(e.target.value)}
          />
          {clayBodyOptions.length > 0 && (
            <datalist id="clay-body-options">
              {clayBodyOptions.map(opt => <option key={opt} value={opt} />)}
            </datalist>
          )}
        </div>

        {/* Stage selector */}
        <div>
          <label className="block text-xs uppercase tracking-widest text-stone-500 mb-2">Stage</label>
          <div className="flex flex-wrap gap-2">
            {STAGES.map((s) => (
              <button
                key={s}
                onClick={() => setStage(s)}
                className={`px-4 py-1.5 rounded-full text-sm border transition-colors cursor-pointer ${stage === s
                    ? 'bg-[#78350f] text-white border-[#78350f] hover:bg-[#5c2709]'
                    : 'border-stone-300 text-stone-700 bg-white hover:bg-stone-50'
                  }`}
              >
                {STAGE_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Form tags */}
        <div>
          <label className="block text-xs uppercase tracking-widest text-stone-500 mb-2">Form</label>
          <div className="flex flex-wrap gap-2">
            {FORM_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedForm(selectedForm === tag ? null : tag)}
                className={`px-4 py-1.5 rounded-full text-sm border transition-colors cursor-pointer ${selectedForm === tag
                    ? 'bg-stone-900 text-white border-stone-900 hover:bg-stone-800'
                    : 'border-stone-300 text-stone-700 bg-white hover:bg-stone-50'
                  }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-red-600 text-xs">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-[#78350f] text-white font-semibold py-3.5 rounded-2xl active:bg-[#5c2709] disabled:opacity-50 text-base mb-2 cursor-pointer hover:bg-[#5c2709]"
        >
          {saving ? 'Saving…' : 'Add piece'}
        </button>
      </div>
    </BottomSheet>
  )
}
