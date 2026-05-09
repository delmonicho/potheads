import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { getPieces, STAGES } from '../lib/pieces.js'
import { getPhotosForPieces, getPhotoUrl } from '../lib/photos.js'
import { getTagsForPieces, getOrCreateTag, addTagToPiece, getUserTags, PRESET_TAGS } from '../lib/tags.js'
import StageColumn, { PieceCard } from '../components/StageColumn.jsx'
import AddPiece from '../components/AddPiece.jsx'
import BottomSheet from '../components/BottomSheet.jsx'

function BookIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v16H6.5A2.5 2.5 0 0 0 4 20.5V4.5z" />
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    </svg>
  )
}

function BrokenVaseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6" />
      <path d="M10 3C8 5 7 7 7 10c0 4 2 7 5 8.5C15 17 17 14 17 10c0-3-1-5-3-7" />
      <path d="M12 6l-1.5 3.5 2 1.5-1.5 4" />
    </svg>
  )
}

function SelectIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="6" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="9" cy="18" r="1.5" fill="currentColor" stroke="none" />
      <line x1="14" y1="6" x2="21" y2="6" />
      <line x1="14" y1="12" x2="21" y2="12" />
      <line x1="14" y1="18" x2="21" y2="18" />
    </svg>
  )
}

export default function Board({ user }) {
  const navigate = useNavigate()
  const [pieces, setPieces] = useState([])
  const [thumbUrls, setThumbUrls] = useState({})  // pieceId → signed URL
  const [formTags, setFormTags] = useState({})     // pieceId → form tag name
  const [allTagsByPiece, setAllTagsByPiece] = useState(new Map()) // pieceId → tags[]
  const [userTags, setUserTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAddPiece, setShowAddPiece] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [viewMode, setViewMode] = useState('stage') // 'stage' | 'clay_body' | 'glaze'

  // Multi-select
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [showTagSheet, setShowTagSheet] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [bulkSaving, setBulkSaving] = useState(false)

  const fetchAll = useCallback(async () => {
    try {
      const data = await getPieces(user.id)
      setPieces(data)

      if (data.length === 0) return

      const pieceIds = data.map(p => p.id)
      const [photosByPiece, tagsByPiece, allUserTags] = await Promise.all([
        getPhotosForPieces(pieceIds),
        getTagsForPieces(pieceIds),
        getUserTags(user.id),
      ])
      setUserTags(allUserTags)

      // Derive form tag name per piece
      const newFormTags = {}
      for (const [pieceId, tags] of tagsByPiece) {
        const ft = tags.find(t => t.category === 'form')
        if (ft) newFormTags[pieceId] = ft.name
      }
      setFormTags(newFormTags)
      setAllTagsByPiece(tagsByPiece)

      // Determine thumbnail photo per piece (latest-stage photo)
      const thumbEntries = []
      for (const piece of data) {
        const photos = photosByPiece.get(piece.id) || []
        if (photos.length > 0) {
          const latestStage = [...STAGES].reverse().find(s => photos.some(p => p.stage === s))
          const thumb = latestStage ? photos.find(p => p.stage === latestStage) : photos[0]
          if (thumb) thumbEntries.push({ pieceId: piece.id, path: thumb.storage_path })
        }
      }

      // Fetch all thumbnail URLs in parallel (cached after first load)
      const urlResults = await Promise.all(
        thumbEntries.map(({ path }) => getPhotoUrl(path).catch(() => null))
      )
      const newThumbUrls = {}
      thumbEntries.forEach(({ pieceId }, i) => { newThumbUrls[pieceId] = urlResults[i] })
      setThumbUrls(newThumbUrls)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user.id])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  function handlePieceAdded() {
    setShowAddPiece(false)
    fetchAll()
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  async function handleBulkDelete() {
    setBulkSaving(true)
    try {
      const tagId = await getOrCreateTag('lost', 'form', user.id)
      await Promise.all([...selectedIds].map(id => addTagToPiece(id, tagId)))
      await fetchAll()
      exitSelectMode()
    } finally {
      setBulkSaving(false)
    }
  }

  async function handleBulkToggleTag(tagName, category) {
    const tagId = await getOrCreateTag(tagName, category, user.id)
    await Promise.all([...selectedIds].map(id => addTagToPiece(id, tagId)))
  }

  async function handleTagSheetDone() {
    setShowTagSheet(false)
    await fetchAll()
    exitSelectMode()
  }

  const activepieces = useMemo(() => pieces.filter(p => {
    if (p.lost) return false
    const tags = allTagsByPiece.get(p.id) || []
    if (tags.some(t => t.name === 'lost')) return false
    return true
  }), [pieces, allTagsByPiece])

  const piecesByStage = useMemo(
    () => STAGES.reduce((acc, stage) => {
      acc[stage] = activepieces.filter(p => p.current_stage === stage)
      return acc
    }, {}),
    [activepieces]
  )

  const clayBodyGroups = useMemo(() => {
    const groups = new Map()
    for (const piece of activepieces) {
      const key = piece.clay_body || '__none'
      const label = piece.clay_body || 'No clay body'
      if (!groups.has(key)) groups.set(key, { label, pieces: [] })
      groups.get(key).pieces.push(piece)
    }
    return [...groups.entries()]
      .sort(([a], [b]) => {
        if (a === '__none') return 1
        if (b === '__none') return -1
        return a.localeCompare(b)
      })
      .map(([key, val]) => ({ key, ...val }))
  }, [activepieces])

  const glazeGroups = useMemo(() => {
    const groups = new Map()
    for (const piece of activepieces) {
      const tags = allTagsByPiece.get(piece.id) || []
      const glazeTags = tags.filter(t => t.category === 'glaze')
      if (glazeTags.length === 0) {
        if (!groups.has('__none')) groups.set('__none', { label: 'No glaze', pieces: [] })
        groups.get('__none').pieces.push(piece)
      } else {
        for (const tag of glazeTags) {
          if (!groups.has(tag.name)) groups.set(tag.name, { label: tag.name, pieces: [] })
          groups.get(tag.name).pieces.push(piece)
        }
      }
    }
    return [...groups.entries()]
      .sort(([a], [b]) => {
        if (a === '__none') return 1
        if (b === '__none') return -1
        return a.localeCompare(b)
      })
      .map(([key, val]) => ({ key, ...val }))
  }, [activepieces, allTagsByPiece])

  const userInitial = (user.user_metadata?.full_name || user.email || '?')[0].toUpperCase()

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      {/* Header */}
      <header className="px-5 pt-safe bg-surface sticky top-0 z-10 border-b border-line/70">
        <div className="flex items-center justify-between pt-3 pb-1">
          <p className="text-xs uppercase tracking-widest text-muted">
            Studio · {activepieces.length} {activepieces.length === 1 ? 'piece' : 'pieces'}
          </p>
          <div className="flex items-center gap-3">
            {selectMode ? (
              <button
                onClick={exitSelectMode}
                className="text-xs uppercase tracking-widest text-clay font-semibold cursor-pointer hover:text-clay-dark"
              >
                Cancel
              </button>
            ) : (
              <button
                onClick={() => setSelectMode(true)}
                className="text-muted active:text-stone-600 cursor-pointer hover:text-stone-600"
                aria-label="Select pieces"
              >
                <SelectIcon />
              </button>
            )}
            <button
              onClick={() => navigate('/catalog')}
              className="text-muted active:text-stone-600 cursor-pointer hover:text-stone-600"
              aria-label="Catalog"
            >
              <BookIcon />
            </button>
            <button
              onClick={() => navigate('/graveyard')}
              className="text-muted active:text-stone-600 cursor-pointer hover:text-stone-600"
              aria-label="Graveyard"
            >
              <BrokenVaseIcon />
            </button>
            <button
              onClick={() => setShowProfile(true)}
              className="w-9 h-9 rounded-full bg-clay flex items-center justify-center active:bg-clay-dark cursor-pointer hover:bg-clay-dark"
              aria-label="Profile"
            >
              <span className="text-white text-sm font-semibold">{userInitial}</span>
            </button>
          </div>
        </div>
        <div className="flex items-baseline justify-between pb-3">
          <h1 className="font-display italic text-4xl text-ink">Potheads.</h1>
          <div className="relative flex items-center">
            <select
              value={viewMode}
              onChange={e => setViewMode(e.target.value)}
              className="appearance-none text-xs uppercase tracking-widest font-semibold text-clay bg-transparent border-none cursor-pointer pr-4 focus:outline-none"
            >
              <option value="stage">Stage</option>
              <option value="clay_body">Clay Body</option>
              <option value="glaze">Glaze</option>
            </select>
            <svg className="pointer-events-none absolute right-0 text-clay" width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <path d="M0 3l5 5 5-5H0z" />
            </svg>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-24">
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-clay border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {error && (
          <p className="text-red-600 text-sm text-center py-4">{error}</p>
        )}
        {!loading && !error && viewMode === 'stage' && STAGES.map((stage) => (
          <StageColumn
            key={stage}
            stage={stage}
            pieces={piecesByStage[stage]}
            thumbUrls={thumbUrls}
            formTags={formTags}
            selectMode={selectMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
          />
        ))}
{!loading && !error && viewMode === 'clay_body' && clayBodyGroups.map(({ key, label, pieces: groupPieces }) => (
          <div key={key} className="mb-8">
            <div className="flex items-baseline justify-between mb-3 border-b border-stone-200 pb-2">
              <h2 className="font-display italic text-2xl text-ink capitalize">{label}</h2>
              <span className="text-sm text-muted tabular-nums">{String(groupPieces.length).padStart(2, '0')}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {groupPieces.map((piece) => (
                <PieceCard key={piece.id} piece={piece} thumbUrl={thumbUrls?.[piece.id] ?? null} formTag={formTags?.[piece.id] ?? null} selectMode={selectMode} selected={selectedIds?.has(piece.id) ?? false} onToggleSelect={toggleSelect} />
              ))}
            </div>
          </div>
        ))}
        {!loading && !error && viewMode === 'glaze' && glazeGroups.map(({ key, label, pieces: groupPieces }) => (
          <div key={key} className="mb-8">
            <div className="flex items-baseline justify-between mb-3 border-b border-stone-200 pb-2">
              <h2 className="font-display italic text-2xl text-ink capitalize">{label}</h2>
              <span className="text-sm text-muted tabular-nums">{String(groupPieces.length).padStart(2, '0')}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {groupPieces.map((piece) => (
                <PieceCard key={piece.id} piece={piece} thumbUrl={thumbUrls?.[piece.id] ?? null} formTag={formTags?.[piece.id] ?? null} selectMode={selectMode} selected={selectedIds?.has(piece.id) ?? false} onToggleSelect={toggleSelect} />
              ))}
            </div>
          </div>
        ))}
      </main>

      {/* FAB */}
      {!selectMode && (
        <button
          onClick={() => setShowAddPiece(true)}
          className="fixed bottom-8 right-5 w-14 h-14 bg-clay text-white text-3xl rounded-full shadow-lg flex items-center justify-center active:bg-clay-dark cursor-pointer hover:bg-clay-dark"
          aria-label="Add piece"
        >
          +
        </button>
      )}

      {/* Bulk action bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-0 inset-x-0 pb-safe bg-white border-t border-stone-200 px-4 pt-3">
          <div className="flex items-center gap-3 pb-3">
            <span className="text-sm text-stone-500 flex-1">
              {selectedIds.size} {selectedIds.size === 1 ? 'piece' : 'pieces'} selected
            </span>
            <button
              onClick={() => setShowTagSheet(true)}
              disabled={bulkSaving}
              className="px-4 py-2 rounded-xl border border-stone-300 text-sm text-ink font-medium active:bg-stone-100 disabled:opacity-50 cursor-pointer hover:bg-stone-100"
            >
              Edit Tags
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={bulkSaving}
              className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium active:bg-red-600 disabled:opacity-50 cursor-pointer hover:bg-red-600"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      <AddPiece
        open={showAddPiece}
        onClose={() => setShowAddPiece(false)}
        onAdded={handlePieceAdded}
        user={user}
      />

      {/* Profile sheet */}
      <BottomSheet
        open={showProfile}
        onClose={() => setShowProfile(false)}
        title="Account"
      >
        <div className="flex flex-col gap-2 pb-4">
          <p className="text-sm text-ink font-medium">{user.user_metadata?.full_name || user.email}</p>
          <p className="text-xs text-muted">{user.email}</p>
          <button
            onClick={handleLogout}
            className="mt-6 text-left text-sm text-red-500 cursor-pointer hover:text-red-700"
          >
            Sign out
          </button>
        </div>
      </BottomSheet>

      {/* Bulk tag sheet */}
      <BottomSheet
        open={showTagSheet}
        onClose={() => setShowTagSheet(false)}
        title={`Edit tags · ${selectedIds.size} ${selectedIds.size === 1 ? 'piece' : 'pieces'}`}
      >
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">Form</p>
            <div className="flex flex-wrap gap-2">
              {PRESET_TAGS.form.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleBulkToggleTag(tag, 'form')}
                  className="px-4 py-1.5 rounded-full text-sm border border-stone-300 text-stone-700 bg-white active:bg-stone-100 cursor-pointer hover:bg-stone-100"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
          {userTags.filter(t => t.category === 'glaze').length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">Glaze</p>
              <div className="flex flex-wrap gap-2">
                {userTags.filter(t => t.category === 'glaze').map((tag) => (
                  <button
                    key={tag.name}
                    onClick={() => handleBulkToggleTag(tag.name, 'glaze')}
                    className="px-4 py-1.5 rounded-full text-sm border border-stone-300 text-stone-700 bg-white active:bg-stone-100 cursor-pointer hover:bg-stone-100"
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={handleTagSheetDone}
            className="w-full bg-clay text-white font-semibold py-3.5 rounded-2xl active:bg-clay-dark mb-2 cursor-pointer hover:bg-clay-dark"
          >
            Done
          </button>
        </div>
      </BottomSheet>

      {/* Delete confirmation sheet */}
      <BottomSheet
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title={`Send ${selectedIds.size} ${selectedIds.size === 1 ? 'piece' : 'pieces'} to graveyard?`}
      >
        <div className="flex flex-col gap-3 pb-2">
          <p className="text-sm text-stone-500">
            {selectedIds.size === 1 ? 'It' : 'They'} will be tagged "lost" and hidden from your board.
          </p>
          <button
            onClick={async () => {
              setShowDeleteConfirm(false)
              await handleBulkDelete()
            }}
            disabled={bulkSaving}
            className="w-full bg-red-500 text-white font-semibold py-3.5 rounded-2xl active:bg-red-600 disabled:opacity-50 cursor-pointer hover:bg-red-600"
          >
            {bulkSaving ? 'Sending to graveyard…' : 'Yes, send to graveyard'}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="w-full bg-stone-100 text-stone-700 font-semibold py-3.5 rounded-2xl active:bg-stone-200 cursor-pointer hover:bg-stone-200"
          >
            Cancel
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
