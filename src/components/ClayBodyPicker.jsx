import { useEffect, useRef, useState } from 'react'
import { listClayBodies } from '../lib/catalog.js'
import { getClayBodies } from '../lib/pieces.js'

const ADD_SENTINEL = '__add__'

export default function ClayBodyPicker({ value, onChange, userId }) {
  const [catalogList, setCatalogList] = useState([])
  const [pastList, setPastList] = useState([])
  const [sessionAdded, setSessionAdded] = useState([])
  const [mode, setMode] = useState('select')
  const [customDraft, setCustomDraft] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([listClayBodies(), getClayBodies(userId)])
      .then(([catalog, past]) => {
        if (cancelled) return
        setCatalogList(catalog || [])
        setPastList(past || [])
      })
      .catch(() => { })
    return () => { cancelled = true }
  }, [userId])

  useEffect(() => {
    if (mode === 'custom') inputRef.current?.focus()
  }, [mode])

  const catalogNames = catalogList.map(cb => cb.name)
  const lc = s => s.toLowerCase()
  const catalogLc = new Set(catalogNames.map(lc))
  const sessionLc = new Set(sessionAdded.map(lc))
  const pastFiltered = pastList.filter(p => !catalogLc.has(lc(p)) && !sessionLc.has(lc(p)))

  const allKnownLc = new Set([
    ...catalogNames.map(lc),
    ...pastFiltered.map(lc),
    ...sessionAdded.map(lc),
  ])
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

  function commitCustom() {
    const trimmed = customDraft.trim()
    if (!trimmed) {
      setMode('select')
      setCustomDraft('')
      return
    }
    const trimmedLc = lc(trimmed)
    const catalogMatch = catalogNames.find(n => lc(n) === trimmedLc)
    if (catalogMatch) {
      onChange(catalogMatch)
    } else {
      const pastMatch = pastList.find(p => lc(p) === trimmedLc)
      const sessionMatch = sessionAdded.find(s => lc(s) === trimmedLc)
      const canonical = pastMatch || sessionMatch || trimmed
      if (!pastMatch && !sessionMatch) {
        setSessionAdded(prev => [...prev, trimmed])
      }
      onChange(canonical)
    }
    setCustomDraft('')
    setMode('select')
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
          className="flex-1 min-w-0 border border-stone-200 rounded-xl px-4 py-3 text-sm text-[#1c1917] bg-white placeholder:text-muted"
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
          disabled={!customDraft.trim()}
          className="px-4 py-3 rounded-xl bg-clay text-white text-sm font-semibold cursor-pointer hover:bg-clay-dark disabled:opacity-50"
        >
          Save
        </button>
        <button
          onClick={cancelCustom}
          className="px-4 py-3 rounded-xl border border-stone-200 text-stone-600 text-sm cursor-pointer hover:bg-stone-50"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <select
      className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-[#1c1917] bg-white cursor-pointer"
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
      {sessionAdded.map(name => (
        <option key={`session:${name}`} value={name}>{name}</option>
      ))}
      <option value={ADD_SENTINEL}>+ Add new clay…</option>
    </select>
  )
}
