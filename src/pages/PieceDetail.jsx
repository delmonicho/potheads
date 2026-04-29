import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { STAGES, STAGE_LABELS, nextStage, advanceStage, markLost, getStageEvents } from '../lib/pieces.js'
import { getPhotosForPiece, uploadPhoto, getPhotoUrl, updatePhotoStage } from '../lib/photos.js'
import { getTagsForPiece, getOrCreateTag, addTagToPiece, removeTagFromPiece, getUserTags, updateTagColor, PRESET_TAGS } from '../lib/tags.js'
import TagChip from '../components/TagChip.jsx'
import BottomSheet from '../components/BottomSheet.jsx'
import PotteryPlaceholder from '../components/PotteryPlaceholder.jsx'
import { useTagColors, detectColor } from '../lib/useTagColors.js'

export default function PieceDetail({ user }) {
  const { id } = useParams()
  const navigate = useNavigate()

  const [piece, setPiece] = useState(null)
  const [photos, setPhotos] = useState([])
  const [photoUrls, setPhotoUrls] = useState([])
  const [heroIndex, setHeroIndex] = useState(0)
  const [pieceNumber, setPieceNumber] = useState(null)
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [showAdvanceSheet, setShowAdvanceSheet] = useState(false)
  const [advanceNote, setAdvanceNote] = useState('')
  const [advanceFile, setAdvanceFile] = useState(null)
  const [advancing, setAdvancing] = useState(false)
  const [stageEvents, setStageEvents] = useState([])
  const [advanceTargetStage, setAdvanceTargetStage] = useState(null)

  const [showTagSheet, setShowTagSheet] = useState(false)
  const [togglingTag, setTogglingTag] = useState(null)

  const [showAddPhotoSheet, setShowAddPhotoSheet] = useState(false)
  const [addPhotoFile, setAddPhotoFile] = useState(null)
  const [addPhotoPreview, setAddPhotoPreview] = useState(null)
  const [addPhotoStage, setAddPhotoStage] = useState(null)
  const [addPhotoNote, setAddPhotoNote] = useState('')
  const [addingPhoto, setAddingPhoto] = useState(false)

  const [userTags, setUserTags] = useState([])

  // Add tag modal
  const [showAddTagSheet, setShowAddTagSheet] = useState(false)
  const [addTagCategory, setAddTagCategory] = useState('form')
  const [addTagName, setAddTagName] = useState('')
  const [addTagColor, setAddTagColor] = useState('#78350f')
  const [tagColorManuallySet, setTagColorManuallySet] = useState(false)
  const { tagColors, recentColors, saveTagColor, addRecentColor } = useTagColors()

  // Lightbox viewer
  const touchStartX = useRef(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(0)
  const [showEditStageSheet, setShowEditStageSheet] = useState(false)
  const [savingStage, setSavingStage] = useState(false)

  const fetchAll = useCallback(async () => {
    try {
      const [{ data: pieceData, error: pieceError }, photosData, tagsData, allUserTags, eventsData] = await Promise.all([
        supabase.from('pieces').select('*').eq('id', id).single(),
        getPhotosForPiece(id),
        getTagsForPiece(id),
        getUserTags(user.id),
        getStageEvents(id),
      ])
      if (pieceError) throw pieceError
      setPiece(pieceData)
      setPhotos(photosData)
      setTags(tagsData)
      setUserTags(allUserTags)
      setStageEvents(eventsData)

      // Resolve signed URLs for all photos
      const urls = await Promise.all(
        photosData.map((p) => getPhotoUrl(p.storage_path).catch(() => null))
      )
      setPhotoUrls(urls)
      // photos[0] is newest (taken_at DESC)
      setHeroIndex(0)

      // Derive piece number: count pieces created at or before this one
      const { count } = await supabase
        .from('pieces')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', pieceData.user_id)
        .lte('created_at', pieceData.created_at)
      setPieceNumber(count)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  useEffect(() => {
    if (!userTags.length) return
    for (const tag of userTags) {
      if (!tag.color && tagColors[tag.name]) {
        updateTagColor(tag.id, tagColors[tag.name]).catch(() => {})
      }
    }
  }, [userTags])

  async function handleAdvance() {
    if (!piece || !advanceTargetStage) return
    setAdvancing(true)
    try {
      await advanceStage(id, advanceTargetStage, advanceNote)
      if (advanceFile) {
        await uploadPhoto({ file: advanceFile, userId: user.id, pieceId: id, stage: advanceTargetStage })
      }
      setShowAdvanceSheet(false)
      setAdvanceNote('')
      setAdvanceFile(null)
      setAdvanceTargetStage(null)
      await fetchAll()
    } catch (err) {
      setError(err.message)
    } finally {
      setAdvancing(false)
    }
  }

  async function handleMarkLost() {
    if (!window.confirm('Mark this piece as lost? It will be hidden from your board.')) return
    try {
      await markLost(id)
      navigate(-1)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleAddPhoto() {
    if (!addPhotoFile) return
    setAddingPhoto(true)
    try {
      await uploadPhoto({ file: addPhotoFile, userId: user.id, pieceId: id, stage: addPhotoStage || null, note: addPhotoNote || null })
      setShowAddPhotoSheet(false)
      setAddPhotoFile(null)
      setAddPhotoPreview(null)
      setAddPhotoStage(null)
      setAddPhotoNote('')
      await fetchAll()
    } catch (err) {
      setError(err.message)
    } finally {
      setAddingPhoto(false)
    }
  }

  async function handleTagToggle(name, category, color) {
    setTogglingTag(name)
    try {
      const tagId = await getOrCreateTag(name, category, user.id, color)
      const existing = tags.find((t) => t.name === name)
      if (existing) {
        await removeTagFromPiece(id, tagId)
      } else {
        await addTagToPiece(id, tagId)
      }
      const updated = await getTagsForPiece(id)
      setTags(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setTogglingTag(null)
    }
  }

  async function handleAddCustomTag() {
    const name = addTagName.trim().toLowerCase()
    if (!name) return
    saveTagColor(name, addTagColor)
    addRecentColor(addTagColor)
    await handleTagToggle(name, addTagCategory, addTagColor)
    const allUserTags = await getUserTags(user.id)
    setUserTags(allUserTags)
    setShowAddTagSheet(false)
    setAddTagName('')
    setAddTagColor('#78350f')
    setTagColorManuallySet(false)
  }

  async function handleEditStage(photoId, stage) {
    setSavingStage(true)
    try {
      await updatePhotoStage(photoId, stage)
      setShowEditStageSheet(false)
      await fetchAll()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingStage(false)
    }
  }

  function getStageStatus(stage) {
    if (!piece) return 'pending'
    const currentIdx = STAGES.indexOf(piece.current_stage)
    const stageIdx = STAGES.indexOf(stage)
    if (stageIdx < currentIdx) return 'complete'
    if (stageIdx === currentIdx) return 'current'
    return 'pending'
  }

  function handleStageTap(stage) {
    const idx = photos.findLastIndex(p => p.stage === stage)
    if (idx !== -1) setHeroIndex(idx)
  }

  function handleHeroTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
  }

  function handleHeroTouchEnd(e) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(dx) < 50) return
    if (dx < 0 && heroIndex < photos.length - 1) setHeroIndex(heroIndex + 1)
    else if (dx > 0 && heroIndex > 0) setHeroIndex(heroIndex - 1)
  }

  const next = piece ? nextStage(piece.current_stage) : null

  const eventByStage = stageEvents.reduce((acc, ev) => {
    acc[ev.stage] = ev
    return acc
  }, {})

  function fmtDate(iso) {
    if (!iso) return null
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  function pickTimestamp(ev) {
    return ev?.created_at || ev?.inserted_at || ev?.occurred_at || ev?.recorded_at || null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#fafaf9]">
        <div className="w-8 h-8 border-4 border-[#78350f] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !piece) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#fafaf9] px-4">
        <p className="text-red-600 text-sm">{error || 'Piece not found'}</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-[#78350f] underline text-sm">Go back</button>
      </div>
    )
  }

  const heroUrl = photoUrls[heroIndex] ?? null

  return (
    <div className="flex flex-col min-h-screen bg-[#fafaf9]">
      {/* Full-bleed hero photo */}
      <div
        className="relative h-[40vh] flex-shrink-0 bg-[#c4a882] overflow-hidden"
        onTouchStart={handleHeroTouchStart}
        onTouchEnd={handleHeroTouchEnd}
        onClick={() => { if (heroUrl) { setViewerIndex(heroIndex); setViewerOpen(true) } }}
      >
        {heroUrl ? (
          <img src={heroUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <PotteryPlaceholder formTag={tags.find((t) => t.category === 'form')?.name} className="rounded-none" />
        )}

        {/* Back button */}
        <button
          onClick={(e) => { e.stopPropagation(); navigate(-1) }}
          style={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}
          className="absolute left-4 w-9 h-9 rounded-full bg-white/80 flex items-center justify-center text-[#1c1917] text-2xl leading-none"
          aria-label="Back"
        >
          ‹
        </button>

        {/* Stage pill — bottom-left */}
        {photos[heroIndex]?.stage && (
          <div className="absolute bottom-3 left-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm pointer-events-none">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
              photos[heroIndex].stage === 'finished' ? 'bg-[#4a7c59]' : 'bg-[#78350f]'
            }`} />
            <span className="text-white text-xs font-medium leading-none">
              {STAGE_LABELS[photos[heroIndex].stage]}
            </span>
          </div>
        )}

        {/* Pagination dots */}
        {photos.length > 1 && (
          <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setHeroIndex(i) }}
                className={`w-2 h-2 rounded-full transition-colors ${i === heroIndex ? 'bg-white' : 'bg-white/50'}`}
              />
            ))}
          </div>
        )}

        {/* Add photo button */}
        <button
          onClick={(e) => { e.stopPropagation(); setAddPhotoStage(piece.current_stage); setShowAddPhotoSheet(true) }}
          className="absolute bottom-3 right-4 w-9 h-9 rounded-full bg-white/80 flex items-center justify-center active:bg-white"
          aria-label="Add photo"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1c1917" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </button>
      </div>

      <main className="flex-1 overflow-y-auto pb-safe">
        {/* Piece identity */}
        <div className="px-5 pt-5 pb-4">
          <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">
            Piece No. {pieceNumber != null ? String(pieceNumber).padStart(3, '0') : '—'}
          </p>
          <h1 className="text-3xl font-semibold text-[#1c1917] leading-tight">{piece.name}</h1>
          {piece.clay_body && (
            <p className="text-sm text-stone-400 mt-1">{piece.clay_body}</p>
          )}
        </div>

        {/* Stage timeline */}
        <div className="px-5 pb-5">
          <p className="text-xs uppercase tracking-widest text-stone-400 mb-4">Stages</p>
          <div className="flex flex-col">
            {STAGES.map((stage, i) => {
              const status = getStageStatus(stage)
              const isLast = i === STAGES.length - 1
              const stagePhotoCount = photos.filter(p => p.stage === stage).length
              return (
                <div
                  key={stage}
                  className="flex gap-4"
                  onClick={stagePhotoCount > 0 ? () => handleStageTap(stage) : undefined}
                  style={stagePhotoCount > 0 ? { cursor: 'pointer' } : undefined}
                >
                  {/* Timeline column */}
                  <div className="flex flex-col items-center">
                    {status === 'complete' && (
                      <div className="w-6 h-6 rounded-full bg-[#4a7c59] flex items-center justify-center flex-shrink-0">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                    {status === 'current' && stage !== 'finished' && (
                      <div className="w-6 h-6 rounded-full bg-[#78350f] flex items-center justify-center flex-shrink-0">
                        <div className="w-2.5 h-2.5 rounded-full bg-white" />
                      </div>
                    )}
                    {status === 'current' && stage === 'finished' && (
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-300 to-amber-600 flex items-center justify-center flex-shrink-0">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="white">
                          <path d="M8 0L9.3 6.7L16 8L9.3 9.3L8 16L6.7 9.3L0 8L6.7 6.7Z" />
                        </svg>
                      </div>
                    )}
                    {status === 'pending' && (
                      <div className="w-6 h-6 rounded-full border-2 border-[#d4c5b0] flex-shrink-0" />
                    )}
                    {!isLast && (
                      <div className="w-px flex-1 min-h-[28px] bg-[#d4c5b0] my-1" />
                    )}
                  </div>

                  {/* Stage info */}
                  <div className={`flex-1 flex items-start justify-between ${isLast ? 'pb-0' : 'pb-5'}`}>
                    <div>
                      <p className={`font-medium leading-tight ${
                        status === 'current' ? 'text-[#78350f]' :
                        status === 'complete' ? 'text-[#4a7c59]' :
                        'text-stone-400'
                      }`}>
                        {STAGE_LABELS[stage]}
                      </p>
                      <p className="text-xs text-stone-400 mt-0.5">
                        {status === 'complete' ? 'complete' : status === 'current' ? 'current' : 'not yet'}
                        {stagePhotoCount > 0 && (
                          <span className="ml-2">{stagePhotoCount} photo{stagePhotoCount > 1 ? 's' : ''}</span>
                        )}
                      </p>
                      {eventByStage[stage] && pickTimestamp(eventByStage[stage]) && (
                        <p className="text-xs text-stone-300 mt-0.5">{fmtDate(pickTimestamp(eventByStage[stage]))}</p>
                      )}
                    </div>
                    {status === 'current' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setAdvanceTargetStage(next || piece.current_stage)
                          setShowAdvanceSheet(true)
                        }}
                        className="ml-3 px-4 py-1.5 bg-[#78350f] text-white text-xs font-semibold rounded-full uppercase tracking-wide active:bg-[#5c2709] flex-shrink-0"
                      >
                        Advance
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Tags */}
        <div className="px-5 py-4 pb-6 border-t border-stone-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs uppercase tracking-widest text-stone-400">Tags</p>
            <button onClick={() => setShowTagSheet(true)} className="text-[#78350f] text-sm font-medium">
              Edit
            </button>
          </div>
          {tags.length === 0 ? (
            <p className="text-stone-400 text-sm">No tags yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <TagChip key={tag.id} tag={tag} selected color={tag.color || tagColors[tag.name]} />
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-stone-100">
          {!piece.lost && (
            <button onClick={handleMarkLost} className="text-red-500 text-sm">
              Mark as lost
            </button>
          )}
          {error && <p className="text-red-600 text-xs mt-2">{error}</p>}
        </div>
      </main>

      {/* Advance stage sheet */}
      <BottomSheet
        open={showAdvanceSheet}
        onClose={() => { setShowAdvanceSheet(false); setAdvanceTargetStage(null) }}
        title="Move to Stage"
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs uppercase tracking-widest text-stone-500 mb-1.5">Select stage</label>
            <div className="flex flex-col gap-2">
              {STAGES.map((s) => (
                <button
                  key={s}
                  onClick={() => setAdvanceTargetStage(s)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-colors ${
                    advanceTargetStage === s
                      ? 'bg-stone-100 border-stone-300 text-[#1c1917] font-semibold'
                      : 'border-stone-200 text-stone-600'
                  }`}
                >
                  <span className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    s === 'finished' ? 'bg-[#4a7c59]' : 'bg-[#78350f]'
                  }`} />
                  <span className="text-sm flex-1 text-left">{STAGE_LABELS[s]}</span>
                  {advanceTargetStage === s && (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8l4 4 6-6" stroke="#78350f" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-stone-500 mb-1.5">Note (optional)</label>
            <textarea
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm text-[#1c1917] bg-stone-50 resize-none"
              rows={3}
              placeholder="Any notes about this stage…"
              value={advanceNote}
              onChange={(e) => setAdvanceNote(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-stone-500 mb-1.5">Photo (optional)</label>
            <input
              type="file"
              accept="image/*"
              className="text-sm text-stone-700"
              onChange={(e) => setAdvanceFile(e.target.files[0] || null)}
            />
          </div>
          <button
            onClick={handleAdvance}
            disabled={advancing || !advanceTargetStage}
            className="w-full bg-[#78350f] text-white font-semibold py-3 rounded-2xl active:bg-[#5c2709] disabled:opacity-50"
          >
            {advancing ? 'Saving…' : `Confirm${advanceTargetStage ? ` move to ${STAGE_LABELS[advanceTargetStage]}` : ''}`}
          </button>
        </div>
      </BottomSheet>

      {/* Tag sheet */}
      <BottomSheet
        open={showTagSheet}
        onClose={() => setShowTagSheet(false)}
        title="Edit Tags"
      >
        <div className="flex flex-col gap-5">
          {Object.entries(PRESET_TAGS).map(([category, presetNames]) => {
            const customNames = userTags
              .filter(t => t.category === category && !presetNames.includes(t.name))
              .map(t => t.name)
            const allNames = [...presetNames, ...customNames]
            return (
              <div key={category}>
                <p className="text-xs uppercase tracking-widest text-stone-400 mb-2">{category}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setAddTagCategory(category)
                      setAddTagName('')
                      setAddTagColor(category === 'glaze' ? '#4a7c59' : '#78350f')
                      setTagColorManuallySet(false)
                      setShowAddTagSheet(true)
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-dashed border-stone-300 text-stone-400 text-sm font-medium active:opacity-70"
                  >
                    + Add
                  </button>
                  {allNames.map((name) => {
                    const isSelected = tags.some((t) => t.name === name)
                    return (
                      <TagChip
                        key={name}
                        tag={{ id: name, name, category }}
                        selected={isSelected}
                        color={tagColors[name]}
                        color={userTags.find(t => t.name === name)?.color || tagColors[name]}
                        onToggle={() => handleTagToggle(name, category)}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
          {togglingTag && <p className="text-stone-400 text-xs text-center">Saving…</p>}
        </div>
      </BottomSheet>

      {/* Add tag sheet */}
      <BottomSheet
        open={showAddTagSheet}
        onClose={() => { setShowAddTagSheet(false); setAddTagName(''); setAddTagColor('#78350f'); setTagColorManuallySet(false) }}
        title={`New ${addTagCategory} tag`}
        zClassName="z-60"
      >
        <div className="flex flex-col gap-5">
          {/* Name */}
          <div>
            <label className="block text-xs uppercase tracking-widest text-stone-400 mb-1.5">Name</label>
            <input
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm bg-stone-50 text-[#1c1917]"
              placeholder={addTagCategory === 'glaze' ? 'e.g. cobalt blue' : 'e.g. yunomi'}
              value={addTagName}
              autoFocus
              onChange={(e) => {
                const val = e.target.value
                setAddTagName(val)
                if (!tagColorManuallySet) {
                  const detected = detectColor(val)
                  if (detected) setAddTagColor(detected)
                }
              }}
            />
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-xs uppercase tracking-widest text-stone-400 mb-2">Color</label>
            <div className="flex items-center gap-3">
              <label className="relative cursor-pointer flex-shrink-0">
                <div
                  className="w-11 h-11 rounded-full border-2 border-stone-200 shadow-inner"
                  style={{ backgroundColor: addTagColor }}
                />
                <input
                  type="color"
                  value={addTagColor}
                  onChange={(e) => { setAddTagColor(e.target.value); setTagColorManuallySet(true) }}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                />
              </label>
              <span className="text-sm text-stone-400">Tap to open color wheel</span>
            </div>
          </div>

          {/* Recent colors */}
          {recentColors.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-widest text-stone-400 mb-2">Recent</p>
              <div className="flex gap-2 flex-wrap">
                {recentColors.map((hex) => (
                  <button
                    key={hex}
                    className={`w-8 h-8 rounded-full border-2 transition-transform active:scale-95 ${addTagColor === hex ? 'border-stone-500 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: hex }}
                    onClick={() => { setAddTagColor(hex); setTagColorManuallySet(true) }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          {addTagName.trim() && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-stone-400 uppercase tracking-widest">Preview</span>
              <TagChip tag={{ id: '__preview', name: addTagName.trim(), category: addTagCategory }} selected color={addTagColor} />
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleAddCustomTag}
            disabled={!addTagName.trim() || !!togglingTag}
            className="w-full bg-[#78350f] text-white font-semibold py-3 rounded-2xl active:bg-[#5c2709] disabled:opacity-40"
          >
            {togglingTag ? 'Saving…' : 'Add tag'}
          </button>
        </div>
      </BottomSheet>

      {/* Add photo sheet */}
      <BottomSheet
        open={showAddPhotoSheet}
        onClose={() => { setShowAddPhotoSheet(false); setAddPhotoFile(null); setAddPhotoPreview(null); setAddPhotoNote('') }}
        title="Add Photo"
      >
        <div className="flex flex-col gap-4">
          <label className="block w-full h-40 rounded-2xl overflow-hidden bg-stone-100 cursor-pointer active:opacity-80 flex-shrink-0">
            {addPhotoPreview ? (
              <img src={addPhotoPreview} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-stone-400">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span className="text-sm">Tap to add photo</span>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files[0]
                if (!f) return
                setAddPhotoFile(f)
                setAddPhotoPreview(URL.createObjectURL(f))
              }}
            />
          </label>

          <div>
            <p className="text-xs uppercase tracking-widest text-stone-500 mb-1.5">Tag with stage (optional)</p>
            <div className="flex flex-wrap gap-2">
              {STAGES.map((s) => (
                <button
                  key={s}
                  onClick={() => setAddPhotoStage(addPhotoStage === s ? null : s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    addPhotoStage === s
                      ? 'bg-[#78350f] text-white border-[#78350f]'
                      : 'bg-white text-stone-600 border-stone-200'
                  }`}
                >
                  {STAGE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-stone-500 mb-1.5">Note (optional)</label>
            <textarea
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm text-[#1c1917] bg-stone-50 resize-none"
              rows={2}
              placeholder="Any notes about this photo…"
              value={addPhotoNote}
              onChange={(e) => setAddPhotoNote(e.target.value)}
            />
          </div>

          <button
            onClick={handleAddPhoto}
            disabled={!addPhotoFile || addingPhoto}
            className="w-full bg-[#78350f] text-white font-semibold py-3 rounded-2xl active:bg-[#5c2709] disabled:opacity-50"
          >
            {addingPhoto ? 'Uploading…' : 'Add Photo'}
          </button>
        </div>
      </BottomSheet>

      {/* Full-screen photo lightbox */}
      {viewerOpen && (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col">
          {/* Top bar: stage pill + close */}
          <div
            className="flex items-center justify-between px-4 flex-shrink-0"
            style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
          >
            <div className="flex items-center gap-2">
              {photos[viewerIndex]?.stage ? (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    photos[viewerIndex].stage === 'finished' ? 'bg-[#4a7c59]' : 'bg-[#78350f]'
                  }`} />
                  <span className="text-white text-xs font-medium">{STAGE_LABELS[photos[viewerIndex].stage]}</span>
                </span>
              ) : (
                <span className="text-white/40 text-xs">No stage tagged</span>
              )}
            </div>
            <button
              onClick={() => setViewerOpen(false)}
              className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-white text-xl leading-none active:bg-white/30"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Photo — swipeable */}
          <div
            className="flex-1 flex items-center justify-center overflow-hidden"
            onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX }}
            onTouchEnd={(e) => {
              if (touchStartX.current === null) return
              const dx = e.changedTouches[0].clientX - touchStartX.current
              touchStartX.current = null
              if (Math.abs(dx) < 50) return
              if (dx < 0 && viewerIndex < photos.length - 1) setViewerIndex(v => v + 1)
              else if (dx > 0 && viewerIndex > 0) setViewerIndex(v => v - 1)
            }}
          >
            {photoUrls[viewerIndex] ? (
              <img
                src={photoUrls[viewerIndex]}
                alt=""
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          {/* Bottom bar: note + counter + edit stage */}
          <div
            className="flex-shrink-0 px-4 flex flex-col gap-2"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
          >
            {photos[viewerIndex]?.note && (
              <p className="text-white/80 text-sm text-center px-2">{photos[viewerIndex].note}</p>
            )}
            <p className="text-white/40 text-xs text-center tabular-nums">
              {viewerIndex + 1} / {photos.length}
            </p>
            <button
              onClick={() => setShowEditStageSheet(true)}
              className="w-full py-3 rounded-2xl bg-white/15 text-white text-sm font-semibold active:bg-white/25"
            >
              Edit stage
            </button>
          </div>
        </div>
      )}

      {/* Edit stage sheet — z-[70] renders above lightbox */}
      <BottomSheet
        open={showEditStageSheet}
        onClose={() => setShowEditStageSheet(false)}
        title="Set stage for this photo"
        zClassName="z-[70]"
      >
        <div className="flex flex-col gap-3 pb-2">
          <button
            onClick={() => handleEditStage(photos[viewerIndex]?.id, null)}
            disabled={savingStage}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-colors disabled:opacity-50 ${
              !photos[viewerIndex]?.stage
                ? 'bg-stone-100 border-stone-300 text-[#1c1917] font-semibold'
                : 'border-stone-200 text-stone-500'
            }`}
          >
            <span className="w-3 h-3 rounded-full border-2 border-stone-400 flex-shrink-0" />
            <span className="text-sm">No stage</span>
          </button>
          {STAGES.map((s) => (
            <button
              key={s}
              onClick={() => handleEditStage(photos[viewerIndex]?.id, s)}
              disabled={savingStage}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-colors disabled:opacity-50 ${
                photos[viewerIndex]?.stage === s
                  ? 'bg-stone-100 border-stone-300 text-[#1c1917] font-semibold'
                  : 'border-stone-200 text-stone-600'
              }`}
            >
              <span className={`w-3 h-3 rounded-full flex-shrink-0 ${
                s === 'finished' ? 'bg-[#4a7c59]' : 'bg-[#78350f]'
              }`} />
              <span className="text-sm">{STAGE_LABELS[s]}</span>
            </button>
          ))}
          {savingStage && <p className="text-center text-xs text-stone-400">Saving…</p>}
        </div>
      </BottomSheet>
    </div>
  )
}
