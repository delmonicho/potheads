import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { getPieces, markLost, STAGES } from '../lib/pieces.js'
import { getOrCreateTag, addTagToPiece, removeTagFromPiece, PRESET_TAGS } from '../lib/tags.js'
import StageColumn from '../components/StageColumn.jsx'
import AddPiece from '../components/AddPiece.jsx'
import BottomSheet from '../components/BottomSheet.jsx'

function StudioIcon({ active }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#78350f' : '#a8a29e'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function ProfileIcon({ active }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#78350f' : '#a8a29e'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

export default function Board({ user }) {
  const [pieces, setPieces] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAddPiece, setShowAddPiece] = useState(false)
  const [activeTab, setActiveTab] = useState('studio')

  // Multi-select
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [showTagSheet, setShowTagSheet] = useState(false)
  const [bulkSaving, setBulkSaving] = useState(false)

  const fetchPieces = useCallback(async () => {
    try {
      const data = await getPieces(user.id)
      setPieces(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user.id])

  useEffect(() => {
    fetchPieces()
  }, [fetchPieces])

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  function handlePieceAdded() {
    setShowAddPiece(false)
    fetchPieces()
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
      for (const id of selectedIds) await markLost(id)
      await fetchPieces()
      exitSelectMode()
    } finally {
      setBulkSaving(false)
    }
  }

  async function handleBulkToggleTag(tagName, category) {
    const tagId = await getOrCreateTag(tagName, category, user.id)
    for (const id of selectedIds) await addTagToPiece(id, tagId)
  }

  async function handleTagSheetDone() {
    setShowTagSheet(false)
    await fetchPieces()
    exitSelectMode()
  }

  const piecesByStage = STAGES.reduce((acc, stage) => {
    acc[stage] = pieces.filter((p) => p.current_stage === stage)
    return acc
  }, {})

  return (
    <div className="flex flex-col min-h-screen bg-[#fafaf9]">
      {/* Header */}
      <header className="px-5 pt-safe bg-[#fafaf9]">
        <div className="flex items-center justify-between pt-3 pb-1">
          <p className="text-xs uppercase tracking-widest text-stone-400">
            Studio · {pieces.length} {pieces.length === 1 ? 'piece' : 'pieces'}
          </p>
          {activeTab === 'studio' && (
            selectMode ? (
              <button
                onClick={exitSelectMode}
                className="text-xs uppercase tracking-widest text-[#78350f] font-semibold"
              >
                Cancel
              </button>
            ) : (
              <button
                onClick={() => setSelectMode(true)}
                className="text-xs uppercase tracking-widest text-stone-400 active:text-stone-600"
              >
                Select
              </button>
            )
          )}
        </div>
        <h1 className="font-display italic text-4xl text-[#1c1917] pb-3">Potheads.</h1>
      </header>

      {/* Body */}
      {activeTab === 'studio' ? (
        <main className="flex-1 overflow-y-auto px-4 py-4 pb-28">
          {loading && (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-[#78350f] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {error && (
            <p className="text-red-600 text-sm text-center py-4">{error}</p>
          )}
          {!loading && !error && STAGES.map((stage) => (
            <StageColumn
              key={stage}
              stage={stage}
              pieces={piecesByStage[stage]}
              selectMode={selectMode}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
            />
          ))}
        </main>
      ) : (
        <main className="flex-1 overflow-y-auto px-5 py-8 pb-28">
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-widest text-stone-400 mb-4">Account</p>
            <p className="text-sm text-[#1c1917] font-medium">{user.user_metadata?.full_name || user.email}</p>
            <p className="text-xs text-stone-400">{user.email}</p>
            <button
              onClick={handleLogout}
              className="mt-6 text-left text-sm text-red-500"
            >
              Sign out
            </button>
          </div>
        </main>
      )}

      {/* FAB — only on studio tab, hidden in select mode */}
      {activeTab === 'studio' && !selectMode && (
        <button
          onClick={() => setShowAddPiece(true)}
          className="fixed bottom-20 right-5 w-14 h-14 bg-[#78350f] text-white text-3xl rounded-full shadow-lg flex items-center justify-center active:bg-[#5c2709]"
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
              className="px-4 py-2 rounded-xl border border-stone-300 text-sm text-[#1c1917] font-medium active:bg-stone-100 disabled:opacity-50"
            >
              Edit Tags
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkSaving}
              className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium active:bg-red-600 disabled:opacity-50"
            >
              {bulkSaving ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      )}

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 pb-safe bg-white border-t border-stone-200 flex" style={{ display: selectMode && selectedIds.size > 0 ? 'none' : undefined }}>
        <button
          className="flex-1 flex flex-col items-center justify-center pt-3 pb-2 gap-0.5"
          onClick={() => setActiveTab('studio')}
        >
          <StudioIcon active={activeTab === 'studio'} />
          <span className={`text-[10px] uppercase tracking-widest font-medium ${activeTab === 'studio' ? 'text-[#78350f]' : 'text-stone-400'}`}>
            Studio
          </span>
        </button>
        <button
          className="flex-1 flex flex-col items-center justify-center pt-3 pb-2 gap-0.5"
          onClick={() => setActiveTab('profile')}
        >
          <ProfileIcon active={activeTab === 'profile'} />
          <span className={`text-[10px] uppercase tracking-widest font-medium ${activeTab === 'profile' ? 'text-[#78350f]' : 'text-stone-400'}`}>
            Profile
          </span>
        </button>
      </nav>

      <AddPiece
        open={showAddPiece}
        onClose={() => setShowAddPiece(false)}
        onAdded={handlePieceAdded}
        user={user}
      />

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
                  className="px-4 py-1.5 rounded-full text-sm border border-stone-300 text-stone-700 bg-white active:bg-stone-100"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">Glaze</p>
            <div className="flex flex-wrap gap-2">
              {PRESET_TAGS.glaze.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleBulkToggleTag(tag, 'glaze')}
                  className="px-4 py-1.5 rounded-full text-sm border border-stone-300 text-stone-700 bg-white active:bg-stone-100"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={handleTagSheetDone}
            className="w-full bg-[#78350f] text-white font-semibold py-3.5 rounded-2xl active:bg-[#5c2709] mb-2"
          >
            Done
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
