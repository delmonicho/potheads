import { useState, useEffect, useRef } from 'react'
import { addPiece, STAGES, STAGE_LABELS } from '../lib/pieces.js'
import { getCustomStages, createCustomStage } from '../lib/stages.js'
import { uploadPhoto } from '../lib/photos.js'
import { getOrCreateTag, addTagToPiece, PRESET_TAGS } from '../lib/tags.js'
import BottomSheet from './BottomSheet.jsx'
import ClayBodyPicker from './ClayBodyPicker.jsx'

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

  // Custom stages
  const [customStages, setCustomStages] = useState([])
  const [addingStage, setAddingStage] = useState(false)
  const [newStageName, setNewStageName] = useState('')
  const [savingStage, setSavingStage] = useState(false)
  const [stageError, setStageError] = useState(null)
  const newStageInputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    getCustomStages(user.id).then(setCustomStages).catch(() => {})
  }, [open, user.id])

  useEffect(() => {
    if (addingStage) newStageInputRef.current?.focus()
  }, [addingStage])

  function reset() {
    setName('')
    setClayBody(localStorage.getItem('potheads_last_clay_body') || '')
    setStage('drying')
    setSelectedForm(null)
    setFiles([])
    setPreviews([])
    setError(null)
    setAddingStage(false)
    setNewStageName('')
    setStageError(null)
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

  async function handleCreateStage() {
    if (!newStageName.trim()) return
    setSavingStage(true)
    setStageError(null)
    try {
      const created = await createCustomStage(user.id, newStageName)
      setCustomStages(prev => [...prev, created])
      setStage(created.name)
      setAddingStage(false)
      setNewStageName('')
    } catch (err) {
      setStageError(err.message)
    } finally {
      setSavingStage(false)
    }
  }

  function handleNewStageKeyDown(e) {
    if (e.key === 'Enter') handleCreateStage()
    if (e.key === 'Escape') { setAddingStage(false); setNewStageName('') }
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
          <label className="flex flex-col items-center justify-center w-full h-40 rounded-2xl bg-surface-warm cursor-pointer overflow-hidden hover:bg-surface-warm-hover transition-colors">
            <div className="flex flex-col items-center gap-2">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#78350f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span className="font-display italic text-clay text-sm">Add photos</span>
              <span className="text-muted text-[10px] uppercase tracking-widest">Greenware · Wet</span>
            </div>
            <input type="file" accept="image/*,image/heic,image/heif" multiple className="hidden" onChange={handleFileChange} />
          </label>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-3 gap-2">
              {previews.map((src, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-surface-warm">
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
              <label className="aspect-square rounded-xl border-2 border-dashed border-line-strong flex items-center justify-center cursor-pointer hover:border-clay hover:bg-surface-warm transition-colors">
                <span className="text-muted text-2xl leading-none">+</span>
                <input type="file" accept="image/*,image/heic,image/heif" multiple className="hidden" onChange={handleFileChange} />
              </label>
            </div>
          </div>
        )}

        {/* Name */}
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted mb-1.5">Name</label>
          <input
            type="text"
            className="w-full border border-line rounded-xl px-4 py-3 text-sm text-ink bg-surface-warm placeholder:text-muted"
            placeholder="e.g. Morning bowl"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Clay body */}
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted mb-1.5">Clay Body</label>
          <ClayBodyPicker value={clayBody} onChange={setClayBody} userId={user.id} active={open} />
        </div>

        {/* Stage selector */}
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted mb-2">Stage</label>
          <div className="flex flex-wrap gap-2">
            {STAGES.map((s) => (
              <button
                key={s}
                onClick={() => setStage(s)}
                className={`px-4 py-1.5 rounded-full text-sm border transition-colors cursor-pointer ${stage === s
                    ? 'bg-clay text-white border-clay hover:bg-clay-dark'
                    : 'border-line-strong text-ink-soft bg-surface-warm hover:bg-surface-warm'
                  }`}
              >
                {STAGE_LABELS[s]}
              </button>
            ))}
            {customStages.map((s) => (
              <button
                key={s.id}
                onClick={() => setStage(s.name)}
                className={`px-4 py-1.5 rounded-full text-sm border transition-colors cursor-pointer ${stage === s.name
                    ? 'bg-clay text-white border-clay hover:bg-clay-dark'
                    : 'border-line-strong text-ink-soft bg-surface-warm hover:bg-surface-warm'
                  }`}
              >
                {s.name}
              </button>
            ))}
            {!addingStage && (
              <button
                onClick={() => { setAddingStage(true); setStageError(null) }}
                className="px-4 py-1.5 rounded-full text-sm border border-dashed border-line-strong text-muted hover:border-clay hover:text-clay transition-colors cursor-pointer"
              >
                + Add stage
              </button>
            )}
          </div>
          {addingStage && (
            <div className="flex gap-2 mt-2">
              <input
                ref={newStageInputRef}
                type="text"
                value={newStageName}
                onChange={e => setNewStageName(e.target.value)}
                onKeyDown={handleNewStageKeyDown}
                placeholder="Stage name"
                className="flex-1 border border-line rounded-xl px-3 py-2 text-sm bg-surface-warm text-ink placeholder:text-muted"
              />
              <button
                onClick={handleCreateStage}
                disabled={savingStage || !newStageName.trim()}
                className="px-3 py-2 rounded-xl bg-clay text-white text-sm cursor-pointer disabled:opacity-50 hover:bg-clay-dark"
              >
                {savingStage ? '…' : 'Add'}
              </button>
              <button
                onClick={() => { setAddingStage(false); setNewStageName(''); setStageError(null) }}
                className="px-3 py-2 rounded-xl border border-line text-sm text-muted cursor-pointer hover:bg-surface-warm"
              >
                Cancel
              </button>
            </div>
          )}
          {stageError && <p className="text-red-600 text-xs mt-1">{stageError}</p>}
        </div>

        {/* Form tags */}
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted mb-2">Form</label>
          <div className="flex flex-wrap gap-2">
            {FORM_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedForm(selectedForm === tag ? null : tag)}
                className={`px-4 py-1.5 rounded-full text-sm border transition-colors cursor-pointer ${selectedForm === tag
                    ? 'bg-clay text-white border-clay hover:bg-clay-dark'
                    : 'border-line-strong text-ink-soft bg-surface-warm hover:bg-surface-warm'
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
          className="w-full bg-clay text-white font-semibold py-3.5 rounded-2xl active:bg-clay-dark disabled:opacity-50 text-base mb-2 cursor-pointer hover:bg-clay-dark"
        >
          {saving ? 'Saving…' : 'Add piece'}
        </button>
      </div>
    </BottomSheet>
  )
}
