import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase.js'
import { getPieces, markLost, STAGES } from '../lib/pieces.js'
import { getPhotosForPieces, getPhotoUrl } from '../lib/photos.js'
import { getTagsForPieces, getOrCreateTag, addTagToPiece, getUserTags, PRESET_TAGS } from '../lib/tags.js'
import StageColumn, { PieceCard } from '../components/StageColumn.jsx'
import AddPiece from '../components/AddPiece.jsx'
import BottomSheet from '../components/BottomSheet.jsx'

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
  const [pieces, setPieces] = useState([])
  const [thumbUrls, setThumbUrls] = useState({})  // pieceId → signed URL
  const [formTags, setFormTags] = useState({})     // pieceId → form tag name
  const [allTagsByPiece, setAllTagsByPiece] = useState(new Map()) // pieceId → tags[]
  const [userTags, setUserTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAddPiece, setShowAddPiece] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [viewMode, setViewMode] = useState('stage') // 'stage' | 'tag'

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
      await Promise.all([...selectedIds].map(id => markLost(id)))
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

  const activepieces = useMemo(() => pieces.filter(p => !p.lost && !p.imperfect), [pieces])

  const piecesByStage = useMemo(
    () => STAGES.reduce((acc, stage) => {
      acc[stage] = activepieces.filter(p => p.current_stage === stage)
      return acc
    }, {}),
    [activepieces]
  )

  const imperfectPieces = useMemo(() => pieces.filter(p => p.imperfect && !p.lost), [pieces])
  const lostPieces = useMemo(() => pieces.filter(p => p.lost), [pieces])

  const tagGroups = useMemo(() => {
    const groups = new Map() // tagName → { label, pieces[] }
    for (const piece of activepieces) {
      const tags = allTagsByPiece.get(piece.id) || []
      if (tags.length === 0) {
        if (!groups.has('__untagged')) groups.set('__untagged', { label: 'Untagged', pieces: [] })
        groups.get('__untagged').pieces.push(piece)
      } else {
        for (const tag of tags) {
          if (!groups.has(tag.name)) groups.set(tag.name, { label: tag.name, pieces: [] })
          groups.get(tag.name).pieces.push(piece)
        }
      }
    }
    // Sort alphabetically, untagged last
    return [...groups.entries()]
      .sort(([a], [b]) => {
        if (a === '__untagged') return 1
        if (b === '__untagged') return -1
        return a.localeCompare(b)
      })
      .map(([key, val]) => ({ key, ...val }))
  }, [pieces, allTagsByPiece])

  const userInitial = (user.user_metadata?.full_name || user.email || '?')[0].toUpperCase()

  return (
    <div className="flex flex-col min-h-screen bg-[#fafaf9]">
      {/* Header */}
      <header className="px-5 pt-safe bg-[#fafaf9]">
        <div className="flex items-center justify-between pt-3 pb-1">
          <p className="text-xs uppercase tracking-widest text-muted">
            Studio · {activepieces.length} {activepieces.length === 1 ? 'piece' : 'pieces'}
          </p>
          <div className="flex items-center gap-3">
            {selectMode ? (
              <button
                onClick={exitSelectMode}
                className="text-xs uppercase tracking-widest text-[#78350f] font-semibold cursor-pointer hover:text-[#5c2709]"
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
              onClick={() => setShowProfile(true)}
              className="w-9 h-9 rounded-full bg-[#78350f] flex items-center justify-center active:bg-[#5c2709] cursor-pointer hover:bg-[#5c2709]"
              aria-label="Profile"
            >
              <span className="text-white text-sm font-semibold">{userInitial}</span>
            </button>
          </div>
        </div>
        <div className="flex items-baseline justify-between pb-3">
          <h1 className="font-display italic text-4xl text-[#1c1917]">Potheads.</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewMode('stage')}
              className={`text-xs uppercase tracking-widest font-semibold cursor-pointer transition-colors ${viewMode === 'stage' ? 'text-[#78350f]' : 'text-muted hover:text-stone-600'}`}
            >
              Stage
            </button>
            <button
              onClick={() => setViewMode('tag')}
              className={`text-xs uppercase tracking-widest font-semibold cursor-pointer transition-colors ${viewMode === 'tag' ? 'text-[#78350f]' : 'text-muted hover:text-stone-600'}`}
            >
              Tags
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-24">
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-[#78350f] border-t-transparent rounded-full animate-spin" />
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
        {!loading && !error && viewMode === 'stage' && imperfectPieces.length > 0 && (
          <div className="mb-8">
            <div className="flex items-baseline justify-between mb-3 border-b border-stone-200 pb-2">
              <h2 className="font-display italic text-2xl text-[#1c1917]">Imperfect</h2>
              <span className="text-sm text-muted tabular-nums">{String(imperfectPieces.length).padStart(2, '0')}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {imperfectPieces.map(piece => (
                <PieceCard key={piece.id} piece={piece} thumbUrl={thumbUrls?.[piece.id] ?? null} formTag={formTags?.[piece.id] ?? null} selectMode={selectMode} selected={selectedIds?.has(piece.id) ?? false} onToggleSelect={toggleSelect} />
              ))}
            </div>
          </div>
        )}
        {!loading && !error && viewMode === 'stage' && lostPieces.length > 0 && (
          <div className="mb-8">
            <div className="flex items-baseline justify-between mb-3 border-b border-stone-200 pb-2">
              <h2 className="font-display italic text-2xl text-[#1c1917]">Lost</h2>
              <span className="text-sm text-muted tabular-nums">{String(lostPieces.length).padStart(2, '0')}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {lostPieces.map(piece => (
                <PieceCard key={piece.id} piece={piece} thumbUrl={thumbUrls?.[piece.id] ?? null} formTag={formTags?.[piece.id] ?? null} selectMode={selectMode} selected={selectedIds?.has(piece.id) ?? false} onToggleSelect={toggleSelect} />
              ))}
            </div>
          </div>
        )}
        {!loading && !error && viewMode === 'tag' && tagGroups.map(({ key, label, pieces: groupPieces }) => (
          <div key={key} className="mb-8">
            <div className="flex items-baseline justify-between mb-3 border-b border-stone-200 pb-2">
              <h2 className="font-display italic text-2xl text-[#1c1917] capitalize">{label}</h2>
              <span className="text-sm text-muted tabular-nums">{String(groupPieces.length).padStart(2, '0')}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {groupPieces.map((piece) => (
                <PieceCard
                  key={piece.id}
                  piece={piece}
                  thumbUrl={thumbUrls?.[piece.id] ?? null}
                  formTag={formTags?.[piece.id] ?? null}
                  selectMode={selectMode}
                  selected={selectedIds?.has(piece.id) ?? false}
                  onToggleSelect={toggleSelect}
                />
              ))}
            </div>
          </div>
        ))}
      </main>

      {/* FAB */}
      {!selectMode && (
        <button
          onClick={() => setShowAddPiece(true)}
          className="fixed bottom-8 right-5 w-14 h-14 bg-[#78350f] text-white text-3xl rounded-full shadow-lg flex items-center justify-center active:bg-[#5c2709] cursor-pointer hover:bg-[#5c2709]"
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
              className="px-4 py-2 rounded-xl border border-stone-300 text-sm text-[#1c1917] font-medium active:bg-stone-100 disabled:opacity-50 cursor-pointer hover:bg-stone-100"
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
          <p className="text-sm text-[#1c1917] font-medium">{user.user_metadata?.full_name || user.email}</p>
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
            className="w-full bg-[#78350f] text-white font-semibold py-3.5 rounded-2xl active:bg-[#5c2709] mb-2 cursor-pointer hover:bg-[#5c2709]"
          >
            Done
          </button>
        </div>
      </BottomSheet>

      {/* Delete confirmation sheet */}
      <BottomSheet
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title={`Mark ${selectedIds.size} ${selectedIds.size === 1 ? 'piece' : 'pieces'} as lost?`}
      >
        <div className="flex flex-col gap-3 pb-2">
          <p className="text-sm text-stone-500">
            Marking as lost hides {selectedIds.size === 1 ? 'it' : 'them'} from your board. This can't be undone.
          </p>
          <button
            onClick={async () => {
              setShowDeleteConfirm(false)
              await handleBulkDelete()
            }}
            disabled={bulkSaving}
            className="w-full bg-red-500 text-white font-semibold py-3.5 rounded-2xl active:bg-red-600 disabled:opacity-50 cursor-pointer hover:bg-red-600"
          >
            {bulkSaving ? 'Marking as lost…' : 'Yes, mark as lost'}
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
