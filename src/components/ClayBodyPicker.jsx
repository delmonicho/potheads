import { useEffect, useRef, useState } from 'react'
import { listClayBodies, createClay } from '../lib/catalog.js'
import { getClayBodies } from '../lib/pieces.js'

const ADD_SENTINEL = '__add__'

export default function ClayBodyPicker({ value, onChange, userId, active = true }) {
  const [catalogList, setCatalogList] = useState([])
  const [pastList, setPastList] = useState([])
  const [mode, setMode] = useState('select')
  const [customDraft, setCustomDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!active) return
    let cancelled = false
    Promise.all([listClayBodies(userId), getClayBodies(userId)])
      .then(([catalog, past]) => {
        if (cancelled) return
        setCatalogList(catalog || [])
        setPastList(past || [])
      })
      .catch(() => { })
    return () => { cancelled = true }
  }, [userId, active])

  useEffect(() => {
    if (mode === 'custom') inputRef.current?.focus()
  }, [mode])

  const catalogNames = catalogList.map(cb => cb.name)
  const lc = s => s.toLowerCase()
  const catalogLc = new Set(catalogNames.map(lc))
  const pastFiltered = pastList.filter(p => !catalogLc.has(lc(p)))

  const allKnownLc = new Set([...catalogNames.map(lc), ...pastFiltered.map(lc)])
  const showOrphan = value && !allKnownLc.has(lc(value))

  function handleSelectChange(e) {
    const next = e.target.value
    if (next === ADD_SENTINEL) {
      setCustomDraft('')
      setMode('custom')
      return
    }
    onChange(next)
  }

  async function commitCustom() {
    const trimmed = customDraft.trim()
    if (!trimmed) {
      setMode('select')
      setCustomDraft('')
      return
    }
    // If it already exists in catalog or past, just select it
    const catalogMatch = catalogNames.find(n => lc(n) === lc(trimmed))
    if (catalogMatch) {
      onChange(catalogMatch)
      setCustomDraft('')
      setMode('select')
      return
    }
    const pastMatch = pastList.find(p => lc(p) === lc(trimmed))
    if (pastMatch) {
      onChange(pastMatch)
      setCustomDraft('')
      setMode('select')
      return
    }
    // New clay — save to catalog
    setSaving(true)
    try {
      const created = await createClay(userId, { name: trimmed })
      setCatalogList(await listClayBodies(userId))
      onChange(created.name)
    } catch {
      // Fallback: still select the typed name so the user isn't blocked
      onChange(trimmed)
    } finally {
      setSaving(false)
      setCustomDraft('')
      setMode('select')
    }
  }

  function cancelCustom() {
    setCustomDraft('')
    setMode('select')
  }

  if (mode === 'custom') {
    return (
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          className="flex-1 min-w-0 border border-line rounded-xl px-4 py-3 text-sm text-ink bg-surface-warm placeholder:text-muted"
          placeholder="e.g. Speckled buff"
          value={customDraft}
          onChange={(e) => setCustomDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitCustom()
            else if (e.key === 'Escape') cancelCustom()
          }}
        />
        <button
          onClick={commitCustom}
          disabled={!customDraft.trim() || saving}
          className="px-4 py-3 rounded-xl bg-clay text-white text-sm font-semibold cursor-pointer hover:bg-clay-dark disabled:opacity-50"
        >
          {saving ? '…' : 'Save'}
        </button>
        <button
          onClick={cancelCustom}
          disabled={saving}
          className="px-4 py-3 rounded-xl border border-line text-ink-soft text-sm cursor-pointer hover:bg-surface-warm-hover disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <select
      className="w-full border border-line rounded-xl px-4 py-3 text-sm text-ink bg-surface-warm cursor-pointer"
      value={value || ''}
      onChange={handleSelectChange}
    >
      <option value="">— None —</option>
      {showOrphan && <option value={value}>{value}</option>}
      {catalogList.map(cb => (
        <option key={cb.id} value={cb.name}>{cb.name}</option>
      ))}
      {pastFiltered.map(name => (
        <option key={`past:${name}`} value={name}>{name}</option>
      ))}
      <option value={ADD_SENTINEL}>+ Add new clay…</option>
    </select>
  )
}
