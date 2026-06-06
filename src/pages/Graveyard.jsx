import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPieces, deletePiece, STAGES } from '../lib/pieces.js'
import { getPhotosForPieces, getPhotoUrls } from '../lib/photos.js'
import { getTagsForPieces } from '../lib/tags.js'
import PotteryPlaceholder from '../components/PotteryPlaceholder.jsx'
import BottomSheet from '../components/BottomSheet.jsx'
import PageHeader from '../components/PageHeader.jsx'

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

export default function Graveyard({ user }) {
  const navigate = useNavigate()
  const [pieces, setPieces] = useState([])
  const [thumbUrls, setThumbUrls] = useState({})
  const [formTags, setFormTags] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const fetchAll = useCallback(async () => {
    try {
      const all = await getPieces(user.id)
      const pieceIds = all.map(p => p.id)

      const [photosByPiece, tagsByPiece] = await Promise.all([
        getPhotosForPieces(pieceIds),
        getTagsForPieces(pieceIds),
      ])

      // Filter to pieces tagged "lost" or with the lost boolean
      const lostPieces = all.filter(p => {
        if (p.lost) return true
        const tags = tagsByPiece.get(p.id) || []
        return tags.some(t => t.name === 'lost')
      })

      // Derive form tags (exclude "lost" tag itself)
      const newFormTags = {}
      for (const [pieceId, tags] of tagsByPiece) {
        const ft = tags.find(t => t.category === 'form' && t.name !== 'lost')
        if (ft) newFormTags[pieceId] = ft.name
      }
      setFormTags(newFormTags)

      // Thumbnails
      const thumbEntries = []
      for (const piece of lostPieces) {
        const photos = photosByPiece.get(piece.id) || []
        if (photos.length > 0) {
          const latestStage = [...STAGES].reverse().find(s => photos.some(p => p.stage === s))
          const thumb = latestStage ? photos.find(p => p.stage === latestStage) : photos[0]
          if (thumb) thumbEntries.push({ pieceId: piece.id, path: thumb.storage_path })
        }
      }
      const urlResults = await getPhotoUrls(thumbEntries.map(e => e.path)).catch(() => [])
      const newThumbUrls = {}
      thumbEntries.forEach(({ pieceId }, i) => { newThumbUrls[pieceId] = urlResults[i] })
      setThumbUrls(newThumbUrls)

      setPieces(lostPieces)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user.id])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  function toggleSelect(id) {
    setSelectedIds(prev => {
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
    setBulkDeleting(true)
    try {
      await Promise.all([...selectedIds].map(id => deletePiece(id)))
      setPieces(prev => prev.filter(p => !selectedIds.has(p.id)))
      exitSelectMode()
    } catch (err) {
      setError(err.message)
    } finally {
      setBulkDeleting(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      <PageHeader
        title="Reclaim."
        onBack={() => navigate('/board')}
        trailing={pieces.length > 0 && (
          selectMode ? (
            <button
              onClick={exitSelectMode}
              className="text-xs uppercase tracking-widest text-clay font-semibold cursor-pointer hover:text-clay-dark"
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={() => setSelectMode(true)}
              className="text-muted active:text-ink-soft cursor-pointer hover:text-ink-soft"
              aria-label="Select pieces"
            >
              <SelectIcon />
            </button>
          )
        )}
      />

      <main className="flex-1 px-4 py-2 pb-24">
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-clay border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {error && <p className="text-red-600 text-sm text-center py-4">{error}</p>}
        {!loading && !error && pieces.length === 0 && (
          <p className="text-center text-muted text-sm py-16 px-8">
            Nothing to reclaim. Lost pieces show up here so you can bring them back.
          </p>
        )}
        {!loading && !error && pieces.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {pieces.map(piece => {
              const selected = selectedIds.has(piece.id)
              return (
                <div key={piece.id} className="flex flex-col gap-1">
                  <button
                    onClick={() => selectMode ? toggleSelect(piece.id) : navigate(`/piece/${piece.id}`)}
                    className={`relative aspect-square rounded-2xl overflow-hidden bg-tan cursor-pointer hover:opacity-90 active:opacity-80 ${selected ? 'ring-2 ring-clay' : ''}`}
                  >
                    {thumbUrls[piece.id] ? (
                      <img src={thumbUrls[piece.id]} alt={piece.name} className="w-full h-full object-cover" />
                    ) : (
                      <PotteryPlaceholder form={formTags[piece.id]} className="w-full h-full" />
                    )}
                    {selected && (
                      <div className="absolute inset-0 bg-clay/20 flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full bg-clay flex items-center justify-center">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 6l3 3 5-5" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </button>
                  <p className="text-xs text-ink font-medium truncate px-0.5">{piece.name}</p>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Bulk action bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-0 inset-x-0 pb-safe bg-surface-raised border-t border-line px-4 pt-3">
          <div className="flex items-center gap-3 pb-3">
            <span className="text-sm text-muted flex-1">
              {selectedIds.size} {selectedIds.size === 1 ? 'piece' : 'pieces'} selected
            </span>
            <button
              type="button"
              disabled
              title="Coming soon"
              className="px-3 py-2 rounded-xl border border-clay/40 text-clay text-sm font-medium opacity-60 cursor-not-allowed"
            >
              Restore
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={bulkDeleting}
              className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium active:bg-red-600 disabled:opacity-50 cursor-pointer hover:bg-red-600"
            >
              Delete forever
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation sheet */}
      <BottomSheet
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title={`Delete ${selectedIds.size} ${selectedIds.size === 1 ? 'piece' : 'pieces'} forever?`}
      >
        <div className="flex flex-col gap-3 pb-2">
          <p className="text-sm text-muted">
            This permanently removes {selectedIds.size === 1 ? 'it' : 'them'} from your account. This cannot be undone.
          </p>
          <button
            onClick={async () => {
              setShowDeleteConfirm(false)
              await handleBulkDelete()
            }}
            disabled={bulkDeleting}
            className="w-full bg-red-500 text-white font-semibold py-3.5 rounded-2xl active:bg-red-600 disabled:opacity-50 cursor-pointer hover:bg-red-600"
          >
            {bulkDeleting ? 'Deleting…' : 'Yes, delete forever'}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="w-full bg-surface-warm text-ink-soft font-semibold py-3.5 rounded-2xl active:bg-surface-warm-hover cursor-pointer hover:bg-surface-warm-hover"
          >
            Cancel
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
