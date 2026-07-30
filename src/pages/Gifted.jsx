import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPieces, markGifted, deletePiece, STAGES } from '../lib/pieces.js'
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

export default function Gifted({ user }) {
  const navigate = useNavigate()
  const [pieces, setPieces] = useState([])
  const [thumbUrls, setThumbUrls] = useState({})
  const [formTags, setFormTags] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)
  const [bulkWorking, setBulkWorking] = useState(false)

  const fetchAll = useCallback(async () => {
    try {
      const all = await getPieces(user.id)
      const giftedPieces = all.filter(p => p.gifted)
      const pieceIds = giftedPieces.map(p => p.id)

      const [photosByPiece, tagsByPiece] = await Promise.all([
        getPhotosForPieces(pieceIds),
        getTagsForPieces(pieceIds),
      ])

      const newFormTags = {}
      for (const [pieceId, tags] of tagsByPiece) {
        const ft = tags.find(t => t.category === 'form')
        if (ft) newFormTags[pieceId] = ft.name
      }
      setFormTags(newFormTags)

      const thumbEntries = []
      for (const piece of giftedPieces) {
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

      setPieces(giftedPieces)
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

  async function handleBulkRestore() {
    setBulkWorking(true)
    try {
      await Promise.all([...selectedIds].map(id => markGifted(id, false)))
      setPieces(prev => prev.filter(p => !selectedIds.has(p.id)))
      exitSelectMode()
    } catch (err) {
      setError(err.message)
    } finally {
      setBulkWorking(false)
      setShowRestoreConfirm(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      <PageHeader
        title="Gifted."
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
            Pieces you've gifted show up here. Mark a piece as gifted from its detail view.
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
                    {/* Gift ribbon badge */}
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-stage-complete flex items-center justify-center shadow-sm">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 12 20 22 4 22 4 12" />
                        <rect x="2" y="7" width="20" height="5" />
                        <line x1="12" y1="22" x2="12" y2="7" />
                        <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
                        <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
                      </svg>
                    </div>
                  </button>
                  <p className="text-xs text-ink font-medium truncate px-0.5">{piece.name}</p>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-0 inset-x-0 pb-safe bg-surface-raised border-t border-line px-4 pt-3">
          <div className="flex items-center gap-3 pb-3">
            <span className="text-sm text-muted flex-1">
              {selectedIds.size} {selectedIds.size === 1 ? 'piece' : 'pieces'} selected
            </span>
            <button
              onClick={() => setShowRestoreConfirm(true)}
              disabled={bulkWorking}
              className="px-4 py-2 rounded-xl bg-clay text-white text-sm font-medium active:bg-clay-dark disabled:opacity-50 cursor-pointer hover:bg-clay-dark"
            >
              Move back to board
            </button>
          </div>
        </div>
      )}

      <BottomSheet
        open={showRestoreConfirm}
        onClose={() => setShowRestoreConfirm(false)}
        title={`Move ${selectedIds.size} ${selectedIds.size === 1 ? 'piece' : 'pieces'} back to board?`}
      >
        <div className="flex flex-col gap-3 pb-2">
          <p className="text-sm text-muted">
            {selectedIds.size === 1 ? 'This piece' : 'These pieces'} will reappear on your board.
          </p>
          <button
            onClick={handleBulkRestore}
            disabled={bulkWorking}
            className="w-full bg-clay text-white font-semibold py-3.5 rounded-2xl active:bg-clay-dark disabled:opacity-50 cursor-pointer hover:bg-clay-dark"
          >
            {bulkWorking ? 'Moving…' : 'Yes, move back'}
          </button>
          <button
            onClick={() => setShowRestoreConfirm(false)}
            className="w-full bg-surface-warm text-ink-soft font-semibold py-3.5 rounded-2xl active:bg-surface-warm-hover cursor-pointer hover:bg-surface-warm-hover"
          >
            Cancel
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
