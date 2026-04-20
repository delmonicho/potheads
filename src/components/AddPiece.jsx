import { useState } from 'react'
import { addPiece, STAGES, STAGE_LABELS } from '../lib/pieces.js'
import { uploadPhoto } from '../lib/photos.js'
import { getOrCreateTag, addTagToPiece, PRESET_TAGS } from '../lib/tags.js'
import BottomSheet from './BottomSheet.jsx'

const FORM_TAGS = PRESET_TAGS.form

export default function AddPiece({ open, onClose, onAdded, user }) {
  const [name, setName] = useState('')
  const [clayBody, setClayBody] = useState(() => localStorage.getItem('potheads_last_clay_body') || '')
  const [stage, setStage] = useState('drying')
  const [selectedForm, setSelectedForm] = useState(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function reset() {
    setName('')
    setClayBody(localStorage.getItem('potheads_last_clay_body') || '')
    setStage('drying')
    setSelectedForm(null)
    setFile(null)
    setPreview(null)
    setError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleFileChange(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
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
      if (file) {
        await uploadPhoto({ file, userId: user.id, pieceId: piece.id, stage })
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
        {/* Camera area */}
        <label className="flex flex-col items-center justify-center w-full h-40 rounded-2xl bg-[#f0e8dc] cursor-pointer overflow-hidden">
          {preview ? (
            <img src={preview} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-2">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#78350f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              <span className="font-display italic text-[#78350f] text-sm">Add a photo</span>
              <span className="text-stone-400 text-[10px] uppercase tracking-widest">Greenware · Wet</span>
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </label>

        {/* Name */}
        <div>
          <label className="block text-xs uppercase tracking-widest text-stone-500 mb-1.5">Name</label>
          <input
            type="text"
            className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-[#1c1917] bg-white placeholder:text-stone-400"
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
            className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-[#1c1917] bg-white placeholder:text-stone-400"
            placeholder="e.g. Speckled buff"
            value={clayBody}
            onChange={(e) => setClayBody(e.target.value)}
          />
        </div>

        {/* Stage selector */}
        <div>
          <label className="block text-xs uppercase tracking-widest text-stone-500 mb-2">Stage</label>
          <div className="flex flex-wrap gap-2">
            {STAGES.map((s) => (
              <button
                key={s}
                onClick={() => setStage(s)}
                className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
                  stage === s
                    ? 'bg-[#78350f] text-white border-[#78350f]'
                    : 'border-stone-300 text-stone-700 bg-white'
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
                className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
                  selectedForm === tag
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'border-stone-300 text-stone-700 bg-white'
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
          className="w-full bg-[#78350f] text-white font-semibold py-3.5 rounded-2xl active:bg-[#5c2709] disabled:opacity-50 text-base mb-2"
        >
          {saving ? 'Saving…' : 'Start tracking'}
        </button>
      </div>
    </BottomSheet>
  )
}
