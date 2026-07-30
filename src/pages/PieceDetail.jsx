import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { STAGES, STAGE_LABELS, nextStage, advanceStage, markLost, markGifted, getStageEvents, updatePiece, getPieceIds, getPiecesByIds, upsertStageNote, fmtStageDate } from '../lib/pieces.js'
import { getPhotosForPiece, getPhotosForPieces, uploadPhoto, getPhotoUrls, updatePhotoStage, deletePhoto } from '../lib/photos.js'
import { getTagsForPiece, getOrCreateTag, addTagToPiece, removeTagFromPiece, getUserTags, updateTagColor, renameTag, deleteTag, countPiecesForTag, PRESET_TAGS } from '../lib/tags.js'
import { listGlazes, listGlazeFavorites, toggleGlazeFavorite, createGlaze, updateGlaze, buildGlazeIndex, matchGlaze, listClayBodies, listClayFavorites, toggleClayFavorite, buildClayIndex, matchClay } from '../lib/catalog.js'
import TagChip from '../components/TagChip.jsx'
import BottomSheet from '../components/BottomSheet.jsx'
import PotteryPlaceholder from '../components/PotteryPlaceholder.jsx'
import ClayBodyPicker from '../components/ClayBodyPicker.jsx'
import GlazeDetail from '../components/catalog/GlazeDetail.jsx'
import ClayDetail from '../components/catalog/ClayDetail.jsx'
import { useTagColors, detectColor, CATEGORY_DEFAULTS } from '../lib/useTagColors.js'

const STAGE_RANK = { finished: 4, glazed: 3, bisque_ready: 2, drying: 1 }

const SWIPE_EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)'
const SWIPE_DURATION_MS = 220

export default function PieceDetail({ user }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

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
  const [advanceFiles, setAdvanceFiles] = useState([])
  const [advancePreviews, setAdvancePreviews] = useState([])
  const [advancing, setAdvancing] = useState(false)
  const [stageEvents, setStageEvents] = useState([])
  const [advanceTargetStage, setAdvanceTargetStage] = useState(null)

  const [showTagSheet, setShowTagSheet] = useState(false)
  const [togglingTag, setTogglingTag] = useState(null)
  const [tagSearch, setTagSearch] = useState({ form: '', glaze: '' })

  const [showAddPhotoSheet, setShowAddPhotoSheet] = useState(false)
  const [addPhotoFiles, setAddPhotoFiles] = useState([])
  const [addPhotoPreviews, setAddPhotoPreviews] = useState([])
  const [addPhotoStage, setAddPhotoStage] = useState(null)
  const [addPhotoNote, setAddPhotoNote] = useState('')
  const [addingPhoto, setAddingPhoto] = useState(false)
  const [selectedPhotoIds, setSelectedPhotoIds] = useState(new Set())
  const [showDeletePhotosConfirm, setShowDeletePhotosConfirm] = useState(false)
  const [deletingPhotos, setDeletingPhotos] = useState(false)

  const [userTags, setUserTags] = useState([])

  // Glaze catalog (lazy) — powers the catalog picker + tappable glaze detail.
  const [glazeCatalog, setGlazeCatalog] = useState([])
  const [glazeFaves, setGlazeFaves] = useState(new Set())
  const [selectedGlaze, setSelectedGlaze] = useState(null)
  const [glazeQuery, setGlazeQuery] = useState('')
  const [addingGlaze, setAddingGlaze] = useState(false)
  const [glazeSaving, setGlazeSaving] = useState(false)
  const [glazeSaveError, setGlazeSaveError] = useState(null)
  const glazeIndex = useMemo(() => buildGlazeIndex(glazeCatalog), [glazeCatalog])
  const glazeTags = useMemo(() => tags.filter(t => t.category === 'glaze'), [tags])
  const otherTags = useMemo(() => tags.filter(t => t.category !== 'glaze'), [tags])

  // Clay catalog (lazy) — powers the tappable clay detail (read-only catalog).
  const [clayCatalog, setClayCatalog] = useState([])
  const [clayFaves, setClayFaves] = useState(new Set())
  const [selectedClay, setSelectedClay] = useState(null)
  const clayIndex = useMemo(() => buildClayIndex(clayCatalog), [clayCatalog])
  const clayMatch = piece ? matchClay(clayIndex, piece.clay_body) : null

  // Add tag modal
  const [showAddTagSheet, setShowAddTagSheet] = useState(false)
  const [addTagCategory, setAddTagCategory] = useState('form')
  const [addTagName, setAddTagName] = useState('')
  const [addTagColor, setAddTagColor] = useState('#78350f')
  const [tagColorManuallySet, setTagColorManuallySet] = useState(false)
  const { tagColors, recentColors, saveTagColor, addRecentColor } = useTagColors()

  // Manage / edit tag modal
  const [manageMode, setManageMode] = useState(false)
  const [editingTag, setEditingTag] = useState(null)
  const [editTagName, setEditTagName] = useState('')
  const [editTagColor, setEditTagColor] = useState('#78350f')
  const [editTagManuallySet, setEditTagManuallySet] = useState(false)
  const [editTagSaving, setEditTagSaving] = useState(false)
  const [editTagError, setEditTagError] = useState(null)
  const [showDeleteTagConfirm, setShowDeleteTagConfirm] = useState(false)
  const [tagDeleteCount, setTagDeleteCount] = useState(null)

  // Lightbox viewer
  const touchStartX = useRef(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(0)
  const [showEditStageSheet, setShowEditStageSheet] = useState(false)
  const [savingStage, setSavingStage] = useState(false)

  // Page-level swipe navigation between pieces
  const [pieceIds, setPieceIds] = useState([])
  const [adjacentPreviews, setAdjacentPreviews] = useState({ prev: null, next: null })
  const [dragOffset, setDragOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [enterOffset, setEnterOffset] = useState(0)
  const [noTransition, setNoTransition] = useState(false)
  const [vw, setVw] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 390))
  const swipeWrapperRef = useRef(null)
  const heroRef = useRef(null)
  const gestureRef2 = useRef({ mode: 'idle', startX: 0, startY: 0, lastOffset: 0, samples: [] })
  const exitingRef = useRef(false)
  const exitTimeoutRef = useRef(null)
  // Ref mirror so the touch listeners can read the latest pieceIds without
  // tearing down on every fetchAll-induced array replacement.
  const pieceIdsRef = useRef(pieceIds)
  pieceIdsRef.current = pieceIds

  // Edit piece sheet
  const [showEditPieceSheet, setShowEditPieceSheet] = useState(false)
  const [editName, setEditName] = useState('')
  const [editClayBody, setEditClayBody] = useState('')
  const [editStage, setEditStage] = useState('drying')
  const [editNotes, setEditNotes] = useState('')
  const [editCreatedAt, setEditCreatedAt] = useState('')
  const [savingPiece, setSavingPiece] = useState(false)

  // Mark lost
  const [showMarkLostConfirm, setShowMarkLostConfirm] = useState(false)
  const [markingLost, setMarkingLost] = useState(false)
  const [showMarkGiftedConfirm, setShowMarkGiftedConfirm] = useState(false)
  const [markingGifted, setMarkingGifted] = useState(false)

  // Edit note sheet
  const [showNoteSheet, setShowNoteSheet] = useState(false)
  const [noteStage, setNoteStage] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [noteDate, setNoteDate] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  // Lightbox gesture state (pinch zoom + pan + swipe)
  const [zoomScale, setZoomScale] = useState(1)
  const [zoomTranslate, setZoomTranslate] = useState({ x: 0, y: 0 })
  const [lightboxGesturing, setLightboxGesturing] = useState(false)
  const gestureRef = useRef({
    mode: 'idle',
    startX: 0,
    startY: 0,
    pinchStartDist: 0,
    pinchStartScale: 1,
    panStartX: 0,
    panStartY: 0,
    panStartTx: 0,
    panStartTy: 0,
    multiTouchSeen: false,
    lastTapAt: 0,
  })

  // Reset zoom whenever the active photo or the viewer itself changes
  useEffect(() => {
    setZoomScale(1)
    setZoomTranslate({ x: 0, y: 0 })
    setLightboxGesturing(false)
    gestureRef.current.mode = 'idle'
    gestureRef.current.multiTouchSeen = false
  }, [viewerIndex, viewerOpen])

  // Keyboard arrow navigation in lightbox
  useEffect(() => {
    if (!viewerOpen) return
    function onKeyDown(e) {
      if (e.key === 'ArrowLeft') setViewerIndex(v => Math.max(0, v - 1))
      else if (e.key === 'ArrowRight') setViewerIndex(v => Math.min(photos.length - 1, v + 1))
      else if (e.key === 'Escape') setViewerOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [viewerOpen, photos.length])

  const fetchAll = useCallback(async () => {
    try {
      const [{ data: pieceData, error: pieceError }, photosData, tagsData, eventsData, ids] = await Promise.all([
        supabase.from('pieces').select('*').eq('id', id).single(),
        getPhotosForPiece(id),
        getTagsForPiece(id),
        getStageEvents(id),
        getPieceIds(user.id),
      ])
      if (pieceError) throw pieceError
      // Carousel order: latest stage first (finished → glazed → bisque_ready → drying → untagged); newer first within a stage
      const sortedPhotos = [...photosData].sort((a, b) => {
        const rankDiff = (STAGE_RANK[b.stage] || 0) - (STAGE_RANK[a.stage] || 0)
        if (rankDiff !== 0) return rankDiff
        return new Date(b.taken_at) - new Date(a.taken_at)
      })
      setPiece(pieceData)
      setPhotos(sortedPhotos)
      setTags(tagsData)
      setStageEvents(eventsData)
      setPieceIds(ids)

      // Resolve signed URLs for all photos in one batched Storage request
      const urls = await getPhotoUrls(sortedPhotos.map(p => p.storage_path)).catch(() => [])
      setPhotoUrls(urls)
      setHeroIndex(0)

      // Derive piece number: count pieces created at or before this one
      const { count } = await supabase
        .from('pieces')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', pieceData.user_id)
        .lte('created_at', pieceData.created_at)
      setPieceNumber(count)

      // Pre-fetch adjacent pieces for swipe-peek preview (fire-and-forget)
      const idx = ids.indexOf(id)
      const prevId = idx > 0 ? ids[idx - 1] : null
      const nextId = idx >= 0 && idx < ids.length - 1 ? ids[idx + 1] : null
      const adjacentIds = [prevId, nextId].filter(Boolean)
      if (adjacentIds.length) {
        Promise.all([
          getPiecesByIds(adjacentIds),
          getPhotosForPieces(adjacentIds),
        ]).then(async ([piecesMap, photosMap]) => {
          // Sign both adjacent thumbnails in one batched Storage request
          const firstPhotoPath = (pid) => {
            const photoList = pid ? (photosMap.get(pid) || []) : []
            return photoList[0]?.storage_path || null
          }
          const previewPaths = [firstPhotoPath(prevId), firstPhotoPath(nextId)]
          const [prevUrl, nextUrl] = await getPhotoUrls(previewPaths).catch(() => [])

          const buildPreview = (pid, thumbUrl) => {
            if (!pid) return null
            const p = piecesMap.get(pid)
            if (!p) return null
            return { id: pid, name: p.name, clayBody: p.clay_body, thumbUrl: thumbUrl || null }
          }
          setAdjacentPreviews({
            prev: buildPreview(prevId, prevUrl),
            next: buildPreview(nextId, nextUrl),
          })
        }).catch(() => { /* preview is non-critical */ })
      } else {
        setAdjacentPreviews({ prev: null, next: null })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // The user's full tag list powers only the "Edit details" editor, so fetch it
  // lazily the first time that sheet opens rather than on every piece view. It's
  // user-scoped (not piece-scoped), so it stays valid across swipe navigation;
  // mutation handlers refresh it in place.
  const userTagsLoadedRef = useRef(false)
  useEffect(() => {
    if (!showTagSheet || userTagsLoadedRef.current) return
    let cancelled = false
    getUserTags(user.id)
      .then((t) => {
        if (cancelled) return
        setUserTags(t)
        userTagsLoadedRef.current = true
      })
      .catch(() => { })
    return () => { cancelled = true }
  }, [showTagSheet, user.id])

  useEffect(() => {
    if (!userTags.length) return
    for (const tag of userTags) {
      if (!tag.color && tagColors[tag.name]) {
        updateTagColor(tag.id, tagColors[tag.name]).catch(() => { })
      }
    }
  }, [userTags])

  // Glaze catalog is lazy — never in fetchAll. It loads when the user opens the
  // Edit-details sheet OR when the piece already has glaze tags (so the Glaze
  // section can resolve names → catalog entries and become tappable). On first
  // load, any of the user's glaze tags that don't match the catalog are
  // back-filled as user-scoped custom glazes (requires migration 003).
  const glazeCatalogLoadedRef = useRef(false)
  const loadGlazeCatalog = useCallback(async () => {
    if (glazeCatalogLoadedRef.current) return
    glazeCatalogLoadedRef.current = true
    try {
      const [glazes, faves, ut] = await Promise.all([
        listGlazes(user.id),
        listGlazeFavorites(user.id),
        getUserTags(user.id),
      ])
      setGlazeFaves(faves)
      setUserTags(ut)
      userTagsLoadedRef.current = true

      const index = buildGlazeIndex(glazes)
      const unmatched = ut.filter(t => t.category === 'glaze' && !matchGlaze(index, t.name))
      if (unmatched.length) {
        await Promise.all(unmatched.map(t =>
          createGlaze(user.id, {
            name: t.name,
            hex_swatch: t.color || tagColors[t.name] || CATEGORY_DEFAULTS.glaze,
          }).catch(() => null)
        ))
        setGlazeCatalog(await listGlazes(user.id))
      } else {
        setGlazeCatalog(glazes)
      }
    } catch {
      glazeCatalogLoadedRef.current = false // allow a later retry
    }
  }, [user.id, tagColors])

  useEffect(() => {
    const advanceWantsGlaze = showAdvanceSheet &&
      (advanceTargetStage === 'glazed' || advanceTargetStage === 'finished')
    if (showTagSheet || advanceWantsGlaze || tags.some(t => t.category === 'glaze')) loadGlazeCatalog()
  }, [showTagSheet, showAdvanceSheet, advanceTargetStage, tags, loadGlazeCatalog])

  // Clay catalog (lazy, read-only) — fetched once the piece has a clay_body so the
  // Clay Body chip can resolve its swatch + open a ClayDetail sheet.
  const clayCatalogLoadedRef = useRef(false)
  const loadClayCatalog = useCallback(async () => {
    if (clayCatalogLoadedRef.current) return
    clayCatalogLoadedRef.current = true
    try {
      const [clays, faves] = await Promise.all([
        listClayBodies(),
        listClayFavorites(user.id),
      ])
      setClayCatalog(clays)
      setClayFaves(faves)
    } catch {
      clayCatalogLoadedRef.current = false // allow a later retry
    }
  }, [user.id])

  useEffect(() => {
    if (piece?.clay_body) loadClayCatalog()
  }, [piece?.clay_body, loadClayCatalog])

  // Optimistic clay favorite toggle (mirrors handleToggleGlaze).
  async function handleToggleClay(clayBodyId, on) {
    setClayFaves(prev => {
      const next = new Set(prev)
      on ? next.add(clayBodyId) : next.delete(clayBodyId)
      return next
    })
    try {
      await toggleClayFavorite(user.id, clayBodyId, on)
    } catch (err) {
      setClayFaves(prev => {
        const next = new Set(prev)
        on ? next.delete(clayBodyId) : next.add(clayBodyId)
        return next
      })
      setError(err.message)
    }
  }

  // Optimistic glaze favorite toggle (mirrors Catalog.jsx).
  async function handleToggleGlaze(glazeId, on) {
    setGlazeFaves(prev => {
      const next = new Set(prev)
      on ? next.add(glazeId) : next.delete(glazeId)
      return next
    })
    try {
      await toggleGlazeFavorite(user.id, glazeId, on)
    } catch (err) {
      setGlazeFaves(prev => {
        const next = new Set(prev)
        on ? next.delete(glazeId) : next.add(glazeId)
        return next
      })
      setError(err.message)
    }
  }

  // "Add as custom" — creates a real (editable) catalog glaze, then selects it.
  async function handleAddCustomGlaze(rawName) {
    const trimmed = rawName.trim()
    if (!trimmed || addingGlaze) return
    setAddingGlaze(true)
    try {
      const hex = detectColor(trimmed) || CATEGORY_DEFAULTS.glaze
      await createGlaze(user.id, { name: trimmed, hex_swatch: hex })
      setGlazeCatalog(await listGlazes(user.id))
      saveTagColor(trimmed.toLowerCase(), hex)
      await handleTagToggle(trimmed.toLowerCase(), 'glaze', hex)
      setGlazeQuery('')
    } catch (err) {
      setError(err.message)
    } finally {
      setAddingGlaze(false)
    }
  }

  // Save edits to a custom glaze; if renamed, cascade-rename its glaze tags so
  // the piece↔glaze (name-based) link stays intact.
  async function handleSaveGlaze(fields) {
    if (!selectedGlaze) return
    setGlazeSaving(true)
    setGlazeSaveError(null)
    try {
      const oldName = (selectedGlaze.name || '').toLowerCase()
      const newName = fields.name.trim().toLowerCase()
      const updated = await updateGlaze(selectedGlaze.id, fields)
      if (newName !== oldName) {
        const priorTags = await getUserTags(user.id)
        await Promise.all(
          priorTags
            .filter(t => t.category === 'glaze' && t.name === oldName)
            .map(t => renameTag(t.id, newName).catch(() => null))
        )
        saveTagColor(newName, fields.hex_swatch)
      }
      const [glazes, refreshedTags, ut] = await Promise.all([
        listGlazes(user.id),
        getTagsForPiece(id),
        getUserTags(user.id),
      ])
      setGlazeCatalog(glazes)
      setTags(refreshedTags)
      setUserTags(ut)
      setSelectedGlaze(updated)
    } catch (err) {
      setGlazeSaveError(err.message)
      throw err
    } finally {
      setGlazeSaving(false)
    }
  }

  // A photo's stage "outranks" the piece when it sits later in the workflow than
  // the current stage — the trigger for auto-advancing the piece to that stage.
  function stageOutranksCurrent(stage) {
    if (!stage || !piece) return false
    return (STAGE_RANK[stage] || 0) > (STAGE_RANK[piece.current_stage] || 0)
  }

  async function handleAdvance() {
    if (!piece || !advanceTargetStage) return
    setAdvancing(true)
    try {
      await advanceStage(id, advanceTargetStage, advanceNote)
      if (advanceFiles.length) {
        await Promise.all(advanceFiles.map(f =>
          uploadPhoto({ file: f, userId: user.id, pieceId: id, stage: advanceTargetStage })
        ))
      }
      setShowAdvanceSheet(false)
      setAdvanceNote('')
      setAdvanceFiles([])
      setAdvancePreviews([])
      setAdvanceTargetStage(null)
      await fetchAll()
    } catch (err) {
      setError(err.message)
    } finally {
      setAdvancing(false)
    }
  }

  async function handleAddPhoto() {
    if (!addPhotoFiles.length) return
    setAddingPhoto(true)
    try {
      await Promise.all(addPhotoFiles.map(f =>
        uploadPhoto({ file: f, userId: user.id, pieceId: id, stage: addPhotoStage || null, note: addPhotoNote || null })
      ))
      // Tagging a photo with a stage past the current one moves the piece there,
      // so the user doesn't have to open the Advance modal separately.
      if (stageOutranksCurrent(addPhotoStage)) {
        await advanceStage(id, addPhotoStage, null)
      }
      setShowAddPhotoSheet(false)
      setAddPhotoFiles([])
      setAddPhotoPreviews([])
      setAddPhotoStage(null)
      setAddPhotoNote('')
      setSelectedPhotoIds(new Set())
      await fetchAll()
    } catch (err) {
      setError(err.message)
    } finally {
      setAddingPhoto(false)
    }
  }

  function togglePhotoSelected(photoId) {
    setSelectedPhotoIds(prev => {
      const next = new Set(prev)
      next.has(photoId) ? next.delete(photoId) : next.add(photoId)
      return next
    })
  }

  async function handleBulkDeletePhotos() {
    if (selectedPhotoIds.size === 0) return
    setDeletingPhotos(true)
    try {
      const targets = photos.filter(p => selectedPhotoIds.has(p.id))
      await Promise.all(targets.map(p => deletePhoto(p.id, p.storage_path)))
      setSelectedPhotoIds(new Set())
      setShowDeletePhotosConfirm(false)
      // Pull hero back if it was past the new end
      setHeroIndex(h => Math.max(0, Math.min(h, photos.length - targets.length - 1)))
      await fetchAll()
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingPhotos(false)
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

  function openEditTag(name, category) {
    const t = userTags.find((u) => u.name === name && u.category === category)
    if (!t) return
    setEditingTag(t)
    setEditTagName(t.name)
    setEditTagColor(t.color || tagColors[t.name] || (category === 'glaze' ? '#4a7c59' : '#78350f'))
    setEditTagManuallySet(false)
    setEditTagError(null)
  }

  function closeEditTag() {
    setEditingTag(null)
    setEditTagName('')
    setEditTagColor('#78350f')
    setEditTagManuallySet(false)
    setEditTagError(null)
  }

  async function handleSaveEditTag() {
    if (!editingTag) return
    const newName = editTagName.trim().toLowerCase()
    if (!newName) return
    setEditTagSaving(true)
    setEditTagError(null)
    try {
      if (newName !== editingTag.name) {
        await renameTag(editingTag.id, newName)
        saveTagColor(newName, editTagColor)
      }
      if (editTagColor !== editingTag.color) {
        await updateTagColor(editingTag.id, editTagColor)
        addRecentColor(editTagColor)
      }
      const [allUserTags, refreshedTags] = await Promise.all([
        getUserTags(user.id),
        getTagsForPiece(id),
      ])
      setUserTags(allUserTags)
      setTags(refreshedTags)
      closeEditTag()
    } catch (err) {
      setEditTagError(err.message)
    } finally {
      setEditTagSaving(false)
    }
  }

  async function handleOpenDeleteTagConfirm() {
    if (!editingTag) return
    setTagDeleteCount(null)
    setShowDeleteTagConfirm(true)
    try {
      const n = await countPiecesForTag(editingTag.id)
      setTagDeleteCount(n)
    } catch {
      setTagDeleteCount(null)
    }
  }

  async function handleDeleteEditTag() {
    if (!editingTag) return
    setEditTagSaving(true)
    setEditTagError(null)
    try {
      await deleteTag(editingTag.id)
      const [allUserTags, refreshedTags] = await Promise.all([
        getUserTags(user.id),
        getTagsForPiece(id),
      ])
      setUserTags(allUserTags)
      setTags(refreshedTags)
      setShowDeleteTagConfirm(false)
      closeEditTag()
    } catch (err) {
      setEditTagError(err.message)
    } finally {
      setEditTagSaving(false)
    }
  }

  async function handleEditStage(photoId, stage) {
    setSavingStage(true)
    try {
      await updatePhotoStage(photoId, stage)
      // Retagging a photo to a later stage advances the piece, same as adding one.
      if (stageOutranksCurrent(stage)) {
        await advanceStage(id, stage, null)
      }
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

  // Track viewport width so swipe math survives orientation change.
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Direction-aware entry animation: if we arrived via a swipe, snap the page
  // to the off-screen side opposite the user's gesture, then animate to 0.
  // Adjacent previews are cleared on id-change to avoid showing stale neighbors
  // until fetchAll repopulates them.
  useLayoutEffect(() => {
    exitingRef.current = false
    setDragOffset(0)
    setAdjacentPreviews({ prev: null, next: null })
    const dir = location.state?.swipeDir
    if (!dir) {
      setNoTransition(false)
      setEnterOffset(0)
      return
    }
    const w = window.innerWidth
    // First commit: jump to the start position with no transition.
    setNoTransition(true)
    setEnterOffset(dir === 'forward' ? w : -w)
    // Clear state so back/forward navigation doesn't re-trigger the entry.
    // Going through navigate (not history.replaceState) preserves React Router's
    // internal { idx, key, usr } shape on the history entry.
    navigate(location.pathname, { replace: true, state: null })
    // Two RAFs: first lets the snap paint, second re-enables transition and
    // animates to 0.
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setNoTransition(false)
        setEnterOffset(0)
      })
    })
    return () => {
      cancelAnimationFrame(raf1)
      if (raf2) cancelAnimationFrame(raf2)
    }
  }, [id])

  useEffect(() => () => {
    if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current)
  }, [])

  // Native touch listeners on the swipe wrapper — needs passive:false so we can
  // preventDefault during a horizontal drag and stop the page from scrolling.
  useEffect(() => {
    const el = swipeWrapperRef.current
    if (!el) return

    function onTouchStart(e) {
      if (exitingRef.current) return
      if (e.touches.length !== 1) {
        gestureRef2.current.mode = 'idle'
        return
      }
      const t = e.touches[0]
      // Defer to iOS edge-swipe-back gesture.
      if (t.clientX < 20) {
        gestureRef2.current.mode = 'idle'
        return
      }
      // Defer to the hero's photo-carousel swipe handlers.
      if (heroRef.current && heroRef.current.contains(e.target)) {
        gestureRef2.current.mode = 'idle'
        return
      }
      gestureRef2.current = {
        mode: 'pending',
        startX: t.clientX,
        startY: t.clientY,
        lastOffset: 0,
        samples: [{ x: 0, t: performance.now() }],
      }
    }

    function onTouchMove(e) {
      const g = gestureRef2.current
      if (g.mode === 'idle' || g.mode === 'scrolling') return
      if (e.touches.length !== 1) {
        if (g.mode === 'dragging') {
          setDragging(false)
          setDragOffset(0)
        }
        g.mode = 'idle'
        return
      }
      const t = e.touches[0]
      const dx = t.clientX - g.startX
      const dy = t.clientY - g.startY

      if (g.mode === 'pending') {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
        if (Math.abs(dy) > Math.abs(dx)) {
          g.mode = 'scrolling'
          return
        }
        g.mode = 'dragging'
        setDragging(true)
      }

      if (g.mode === 'dragging') {
        e.preventDefault()
        const ids = pieceIdsRef.current
        const idx = ids.indexOf(id)
        const atStart = idx <= 0
        const atEnd = idx === -1 || idx >= ids.length - 1
        let offset = dx
        if ((dx > 0 && atStart) || (dx < 0 && atEnd)) offset = dx * 0.3
        g.lastOffset = offset
        setDragOffset(offset)
        const now = performance.now()
        g.samples.push({ x: dx, t: now })
        while (g.samples.length > 2 && now - g.samples[0].t > 100) g.samples.shift()
      }
    }

    function onTouchEnd() {
      const g = gestureRef2.current
      if (g.mode !== 'dragging') {
        g.mode = 'idle'
        return
      }
      g.mode = 'idle'
      setDragging(false)

      const offset = g.lastOffset
      const w = window.innerWidth
      const threshold = w * 0.25

      let velocity = 0
      if (g.samples.length >= 2) {
        const first = g.samples[0]
        const last = g.samples[g.samples.length - 1]
        const dt = last.t - first.t
        if (dt > 0) velocity = (last.x - first.x) / dt
      }

      const ids = pieceIdsRef.current
      const idx = ids.indexOf(id)
      const atStart = idx <= 0
      const atEnd = idx === -1 || idx >= ids.length - 1

      const wantsNext = (offset < -threshold || velocity < -0.5) && !atEnd
      const wantsPrev = (offset > threshold || velocity > 0.5) && !atStart

      if (wantsNext) {
        exitingRef.current = true
        setDragOffset(-w)
        exitTimeoutRef.current = setTimeout(() => {
          navigate('/piece/' + ids[idx + 1], { state: { swipeDir: 'forward' } })
        }, SWIPE_DURATION_MS)
      } else if (wantsPrev) {
        exitingRef.current = true
        setDragOffset(w)
        exitTimeoutRef.current = setTimeout(() => {
          navigate('/piece/' + ids[idx - 1], { state: { swipeDir: 'backward' } })
        }, SWIPE_DURATION_MS)
      } else {
        setDragOffset(0)
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('touchcancel', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [id, navigate])

  function toDateInput(iso) {
    if (!iso) return ''
    return new Date(iso).toISOString().slice(0, 10)
  }

  function fromDateInput(val) {
    if (!val) return null
    return new Date(val + 'T12:00:00').toISOString()
  }

  async function handleMarkLost() {
    setMarkingLost(true)
    try {
      await markLost(id)
      navigate('/board')
    } catch (err) {
      setError(err.message)
      setMarkingLost(false)
    }
  }

  async function handleMarkGifted() {
    setMarkingGifted(true)
    try {
      await markGifted(id, true)
      navigate('/board')
    } catch (err) {
      setError(err.message)
      setMarkingGifted(false)
    }
  }

  function openEditPiece() {
    if (!piece) return
    setEditName(piece.name || '')
    setEditClayBody(piece.clay_body || '')
    setEditStage(piece.current_stage)
    setEditNotes(piece.notes || '')
    setEditCreatedAt(toDateInput(piece.created_at))
    setShowEditPieceSheet(true)
  }

  async function handleSavePiece() {
    if (!piece) return
    const name = editName.trim()
    if (!name) return
    setSavingPiece(true)
    try {
      await updatePiece(id, {
        name,
        clayBody: editClayBody.trim(),
        currentStage: editStage,
        notes: editNotes.trim(),
        createdAt: fromDateInput(editCreatedAt),
      })
      setShowEditPieceSheet(false)
      await fetchAll()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingPiece(false)
    }
  }

  function openNoteSheet(stage) {
    if (!piece) return
    const existing = stageEvents.find((ev) => ev.stage === stage)
    setNoteStage(stage)
    setNoteText(existing?.notes || '')
    setNoteDate(toDateInput(existing?.moved_at || (stage === initialStage ? piece.created_at : null)))
    setShowNoteSheet(true)
  }

  async function handleSaveNote() {
    if (!piece || !noteStage) return
    setSavingNote(true)
    try {
      const fallback = noteStage === initialStage ? piece.created_at : null
      const movedAt = fromDateInput(noteDate)
      await upsertStageNote(id, noteStage, noteText, fallback, movedAt)
      setShowNoteSheet(false)
      setNoteStage(null)
      setNoteText('')
      setNoteDate('')
      await fetchAll()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingNote(false)
    }
  }

  // ─── Lightbox gestures ────────────────────────────────────────────────
  const ZOOM_MIN = 1
  const ZOOM_MAX = 4

  function pinchDistance(t0, t1) {
    return Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY)
  }

  function clampPan(tx, ty, scale) {
    const w = typeof window !== 'undefined' ? window.innerWidth : 0
    const h = typeof window !== 'undefined' ? window.innerHeight : 0
    const maxX = (w * (scale - 1)) / 2 + 40
    const maxY = (h * (scale - 1)) / 2 + 40
    return {
      x: Math.max(-maxX, Math.min(maxX, tx)),
      y: Math.max(-maxY, Math.min(maxY, ty)),
    }
  }

  function handleViewerTouchStart(e) {
    setLightboxGesturing(true)
    const g = gestureRef.current
    if (e.touches.length >= 2) {
      g.mode = 'pinch'
      g.multiTouchSeen = true
      g.pinchStartDist = pinchDistance(e.touches[0], e.touches[1])
      g.pinchStartScale = zoomScale
    } else if (e.touches.length === 1) {
      if (zoomScale > 1) {
        g.mode = 'pan'
        g.panStartX = e.touches[0].clientX
        g.panStartY = e.touches[0].clientY
        g.panStartTx = zoomTranslate.x
        g.panStartTy = zoomTranslate.y
      } else {
        g.mode = 'swipe'
        g.startX = e.touches[0].clientX
        g.startY = e.touches[0].clientY
      }
    }
  }

  function handleViewerTouchMove(e) {
    const g = gestureRef.current
    if (e.touches.length >= 2) {
      g.multiTouchSeen = true
      if (g.mode !== 'pinch') {
        g.mode = 'pinch'
        g.pinchStartDist = pinchDistance(e.touches[0], e.touches[1])
        g.pinchStartScale = zoomScale
        return
      }
      if (g.pinchStartDist > 0) {
        const dist = pinchDistance(e.touches[0], e.touches[1])
        const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, g.pinchStartScale * (dist / g.pinchStartDist)))
        setZoomScale(next)
        setZoomTranslate(t => clampPan(t.x, t.y, next))
      }
    } else if (g.mode === 'pan' && e.touches.length === 1) {
      const dx = e.touches[0].clientX - g.panStartX
      const dy = e.touches[0].clientY - g.panStartY
      setZoomTranslate(clampPan(g.panStartTx + dx, g.panStartTy + dy, zoomScale))
    }
  }

  function handleViewerTouchEnd(e) {
    const g = gestureRef.current
    if (e.touches.length > 0) return

    const wasMulti = g.multiTouchSeen
    const wasMode = g.mode
    g.mode = 'idle'
    g.multiTouchSeen = false
    setLightboxGesturing(false)

    if (wasMulti) {
      if (zoomScale < 1.05) {
        setZoomScale(1)
        setZoomTranslate({ x: 0, y: 0 })
      }
      return
    }

    if (wasMode === 'swipe') {
      const t = e.changedTouches[0]
      const dx = t.clientX - g.startX
      const dy = t.clientY - g.startY
      if (Math.abs(dx) < 50) return
      if (Math.abs(dy) > Math.abs(dx)) return
      if (dx < 0 && viewerIndex < photos.length - 1) setViewerIndex(v => v + 1)
      else if (dx > 0 && viewerIndex > 0) setViewerIndex(v => v - 1)
    }
  }

  function handleViewerClick(e) {
    // Double-tap toggles between 1× and 2.5× centered on the tap.
    const g = gestureRef.current
    const now = Date.now()
    if (now - g.lastTapAt < 300) {
      g.lastTapAt = 0
      if (zoomScale > 1) {
        setZoomScale(1)
        setZoomTranslate({ x: 0, y: 0 })
      } else {
        const newScale = 2.5
        const cx = window.innerWidth / 2
        const cy = window.innerHeight / 2
        const tx = (cx - e.clientX) * (newScale - 1)
        const ty = (cy - e.clientY) * (newScale - 1)
        setZoomScale(newScale)
        setZoomTranslate(clampPan(tx, ty, newScale))
      }
    } else {
      g.lastTapAt = now
    }
  }

  const next = piece ? nextStage(piece.current_stage) : null

  const eventByStage = stageEvents.reduce((acc, ev) => {
    acc[ev.stage] = ev
    return acc
  }, {})

  function pickTimestamp(ev) {
    return ev?.moved_at || ev?.created_at || ev?.inserted_at || null
  }

  const initialStage = (() => {
    if (!piece) return null
    if (stageEvents.length === 0) return piece.current_stage
    const earliestIdx = stageEvents.reduce((min, ev) => {
      const idx = STAGES.indexOf(ev.stage)
      return idx >= 0 && idx < min ? idx : min
    }, STAGES.length)
    return STAGES[Math.max(0, earliestIdx - 1)]
  })()

  function stageTimestamp(stage) {
    const fromEvent = pickTimestamp(eventByStage[stage])
    if (fromEvent) return fromEvent
    if (stage === initialStage) return piece?.created_at || null
    return null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <div className="w-8 h-8 border-4 border-clay border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !piece) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-surface px-4">
        <p className="text-red-600 text-sm">{error || 'Piece not found'}</p>
        <button onClick={() => navigate('/board')} className="mt-4 text-clay underline text-sm cursor-pointer hover:text-clay-dark">Go back</button>
      </div>
    )
  }

  const heroUrl = photoUrls[heroIndex] ?? null

  const wrapperOffset = dragOffset + enterOffset
  const wrapperTransition = (dragging || noTransition)
    ? 'none'
    : `transform ${SWIPE_DURATION_MS}ms ${SWIPE_EASE}`
  const wrapperShadow =
    dragOffset < -2 ? '8px 0 16px -6px rgba(0,0,0,0.18)'
      : dragOffset > 2 ? '-8px 0 16px -6px rgba(0,0,0,0.18)'
        : 'none'

  return (
    <>
      <div className="relative min-h-screen overflow-hidden bg-surface">
        {/* Previous-piece peek panel — 8px sliver visible at rest as a
          page-turn affordance. The right edge gets a soft shadow that reads
          as a catalog-page gutter against the active page. */}
        <div
          className="absolute inset-0 pointer-events-none overflow-hidden before:absolute before:inset-y-0 before:right-0 before:w-3 before:bg-gradient-to-l before:from-black/10 before:to-transparent before:z-10"
          style={{
            transform: `translate3d(${wrapperOffset - vw + 8}px, 0, 0)`,
            transition: wrapperTransition,
            willChange: 'transform',
          }}
          aria-hidden="true"
        >
          {adjacentPreviews.prev && <PiecePreview preview={adjacentPreviews.prev} />}
        </div>

        {/* Next-piece peek panel — mirror sliver. */}
        <div
          className="absolute inset-0 pointer-events-none overflow-hidden before:absolute before:inset-y-0 before:left-0 before:w-3 before:bg-gradient-to-r before:from-black/10 before:to-transparent before:z-10"
          style={{
            transform: `translate3d(${wrapperOffset + vw - 8}px, 0, 0)`,
            transition: wrapperTransition,
            willChange: 'transform',
          }}
          aria-hidden="true"
        >
          {adjacentPreviews.next && <PiecePreview preview={adjacentPreviews.next} />}
        </div>

        {/* Active page — swipeable wrapper. Owns the vertical scroll itself so
          touch-action: pan-y applies on the same element where horizontal
          gestures originate; otherwise iOS commits diagonal touches to an
          inner overflow:auto descendant before our threshold trips. */}
        <div
          ref={swipeWrapperRef}
          className="relative flex flex-col h-[100dvh] overflow-y-auto overscroll-y-contain bg-surface"
          style={{
            transform: `translate3d(${wrapperOffset}px, 0, 0)`,
            transition: wrapperTransition,
            boxShadow: wrapperShadow,
            touchAction: 'pan-y',
            userSelect: dragging ? 'none' : 'auto',
            willChange: 'transform',
          }}
        >
          {/* Full-bleed hero photo */}
          <div
            ref={heroRef}
            className={`relative h-[40vh] md:max-h-120 shrink-0 bg-tan overflow-hidden ${heroUrl ? 'cursor-pointer' : ''}`}
            onTouchStart={handleHeroTouchStart}
            onTouchEnd={handleHeroTouchEnd}
            onClick={() => { if (heroUrl) { setViewerIndex(heroIndex); setViewerOpen(true) } }}
          >
            {heroUrl ? (
              <img src={heroUrl} alt="" className="w-full h-full object-contain" />
            ) : (
              <PotteryPlaceholder formTag={tags.find((t) => t.category === 'form')?.name} className="rounded-none" />
            )}

            {/* Back button — larger (44px) circle with an extended invisible hit
              area (before:-inset-2) so a near-miss lands on Back instead of
              opening the photo lightbox. Fixed dark icon: the pill is always
              white, so text-ink would be light-on-light in dark mode. */}
            <button
              onClick={(e) => { e.stopPropagation(); navigate('/board') }}
              style={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}
              className="absolute left-4 w-11 h-11 rounded-full bg-white/80 flex items-center justify-center text-stone-800 text-2xl leading-none cursor-pointer hover:bg-white before:absolute before:-inset-2 before:content-['']"
              aria-label="Back"
            >
              ‹
            </button>

            {/* Stage pill — bottom-left */}
            {photos[heroIndex]?.stage && (
              <div className="absolute bottom-3 left-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm pointer-events-none">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${photos[heroIndex].stage === 'finished' ? 'bg-stage-complete' : 'bg-clay'
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
                    className={`w-2 h-2 rounded-full transition-colors cursor-pointer hover:bg-white ${i === heroIndex ? 'bg-white' : 'bg-white/50'}`}
                  />
                ))}
              </div>
            )}

            {/* Edit photos button */}
            <button
              onClick={(e) => { e.stopPropagation(); setAddPhotoStage(piece.current_stage); setShowAddPhotoSheet(true) }}
              className="absolute bottom-3 right-4 w-9 h-9 rounded-full bg-white/80 flex items-center justify-center active:bg-white cursor-pointer hover:bg-white"
              aria-label="Edit photos"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1c1917" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
              </svg>
            </button>
          </div>

          <main className="flex-1 pb-safe">
            {/* Piece identity */}
            <div className="px-5 pt-5 pb-4">
              <p className="text-xs uppercase tracking-widest text-muted mb-1">
                Piece No. {pieceNumber != null ? String(pieceNumber).padStart(3, '0') : '—'}
                {pieceIds.length > 1 && pieceIds.indexOf(id) >= 0 && (
                  <span> · {pieceIds.indexOf(id) + 1} of {pieceIds.length}</span>
                )}
              </p>
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-3xl font-semibold text-ink leading-tight">{piece.name}</h1>
                <button
                  onClick={openEditPiece}
                  className="text-clay text-sm font-medium flex-shrink-0 mt-1.5 cursor-pointer hover:text-clay-dark"
                >
                  Edit
                </button>
              </div>
              {piece.notes && (
                <p className="text-sm text-ink mt-2 leading-relaxed">{piece.notes}</p>
              )}
            </div>

            {/* Stage timeline */}
            <div className="px-5 pb-5">
              <p className="text-xs uppercase tracking-widest text-muted mb-4">Stages</p>
              <div className="flex flex-col">
                {STAGES.map((stage, i) => {
                  const status = getStageStatus(stage)
                  const isLast = i === STAGES.length - 1
                  const stagePhotoCount = photos.filter(p => p.stage === stage).length
                  return (
                    <div
                      key={stage}
                      className={`flex gap-4 ${stagePhotoCount > 0 ? 'cursor-pointer hover:opacity-80' : ''}`}
                      onClick={stagePhotoCount > 0 ? () => handleStageTap(stage) : undefined}
                    >
                      {/* Timeline column */}
                      <div className="flex flex-col items-center">
                        {status === 'complete' && (
                          <div className="w-6 h-6 rounded-full bg-stage-complete flex items-center justify-center flex-shrink-0">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        )}
                        {status === 'current' && stage !== 'finished' && (
                          <div className="w-6 h-6 rounded-full bg-clay flex items-center justify-center flex-shrink-0">
                            <div className="w-2.5 h-2.5 rounded-full bg-white" />
                          </div>
                        )}
                        {status === 'current' && stage === 'finished' && (
                          <div className="w-6 h-6 rounded-full bg-stage-complete flex items-center justify-center flex-shrink-0">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        )}
                        {status === 'pending' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setAdvanceTargetStage(stage)
                              setShowAdvanceSheet(true)
                            }}
                            aria-label={`Advance to ${STAGE_LABELS[stage]}`}
                            className="w-6 h-6 rounded-full border-[2.5px] border-line-strong hover:border-clay/50 flex-shrink-0 cursor-pointer transition-transform hover:scale-110 active:scale-95"
                          />
                        )}
                        {!isLast && (
                          <div className="w-px flex-1 min-h-[28px] bg-line-strong/60 my-1" />
                        )}
                      </div>

                      {/* Stage info */}
                      <div className={`flex-1 flex items-start justify-between ${isLast ? 'pb-0' : 'pb-5'}`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className={`font-medium leading-tight ${status === 'current' ? 'text-clay' :
                                status === 'complete' ? 'text-stage-complete' :
                                  'text-muted'
                              }`}>
                              {STAGE_LABELS[stage]}
                            </p>
                            {status !== 'pending' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); openNoteSheet(stage) }}
                                className="text-line-strong hover:text-ink-soft cursor-pointer transition-colors"
                                aria-label="Edit note"
                              >
                                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H2v-3L11.5 2.5z" />
                                </svg>
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-muted mt-0.5">
                            {status === 'complete' ? 'complete' : status === 'current' ? 'current' : 'not yet'}
                            {stagePhotoCount > 0 && (
                              <span className="ml-2">{stagePhotoCount} photo{stagePhotoCount > 1 ? 's' : ''}</span>
                            )}
                          </p>
                          {stageTimestamp(stage) && (
                            <p className="text-xs text-muted mt-0.5">{fmtStageDate(stageTimestamp(stage))}</p>
                          )}
                          {status !== 'pending' && eventByStage[stage]?.notes && (
                            <button
                              onClick={(e) => { e.stopPropagation(); openNoteSheet(stage) }}
                              className="mt-1.5 block text-left text-xs text-ink-soft bg-surface-warm rounded-lg px-2.5 py-1.5 max-w-full cursor-pointer hover:bg-surface-warm-hover"
                            >
                              <span className="line-clamp-2">{eventByStage[stage].notes}</span>
                            </button>
                          )}
                        </div>
                        {status === 'current' && next && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setAdvanceTargetStage(next || piece.current_stage)
                              setShowAdvanceSheet(true)
                            }}
                            className="ml-3 px-4 py-1.5 bg-clay text-white text-xs font-semibold rounded-full uppercase tracking-wide active:bg-clay-dark flex-shrink-0 cursor-pointer hover:bg-clay-dark"
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

            {/* Clay body — sourced from the catalog. Tap a catalog match to view detail. */}
            <div className="px-5 py-4 border-t border-line">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs uppercase tracking-widest text-muted">Clay Body</p>
              </div>
              {!piece.clay_body ? (
                <p className="text-muted text-sm">No clay body yet</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <TagChip
                    tag={{ id: 'clay', name: clayMatch?.name || piece.clay_body, category: 'form' }}
                    selected
                    color={clayMatch?.hex_swatch || '#d4c5b0'}
                    onToggle={clayMatch ? () => setSelectedClay(clayMatch) : undefined}
                  />
                </div>
              )}
            </div>

            {/* Glaze — its own category, sourced from the catalog. Tap to view detail. */}
            <div className="px-5 py-4 border-t border-line">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs uppercase tracking-widest text-muted">Glaze</p>
                <button onClick={() => setShowTagSheet(true)} className="text-clay text-sm font-medium cursor-pointer hover:text-clay-dark">
                  Edit
                </button>
              </div>
              {glazeTags.length === 0 ? (
                <p className="text-muted text-sm">No glaze yet</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {glazeTags.map((tag) => {
                    const g = matchGlaze(glazeIndex, tag.name)
                    return (
                      <TagChip
                        key={tag.id}
                        tag={{ id: tag.id, name: g?.name || tag.name, category: 'glaze' }}
                        selected
                        color={g?.hex_swatch || tag.color || tagColors[tag.name] || CATEGORY_DEFAULTS.glaze}
                        onToggle={g ? () => setSelectedGlaze(g) : undefined}
                      />
                    )
                  })}
                </div>
              )}
            </div>

            {/* Form & custom tags */}
            <div className="px-5 py-4 border-t border-line">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs uppercase tracking-widest text-muted">Form</p>
              </div>
              {otherTags.length === 0 ? (
                <p className="text-muted text-sm">No details yet</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {otherTags.map((tag) => (
                    <TagChip key={tag.id} tag={tag} selected color={tag.color || tagColors[tag.name]} />
                  ))}
                </div>
              )}
            </div>

            {/* Send to Reclaim / Gift */}
            <div className="px-5 pt-6 pb-10 border-t border-line flex flex-col gap-3">
              {!piece.gifted && (
                <button
                  onClick={() => setShowMarkGiftedConfirm(true)}
                  className="w-full py-3 rounded-2xl border border-line text-muted text-sm font-medium cursor-pointer hover:border-stage-complete/50 hover:text-stage-complete transition-colors"
                >
                  Gift this piece
                </button>
              )}
              {!piece.lost && (
                <button
                  onClick={() => setShowMarkLostConfirm(true)}
                  className="w-full py-3 rounded-2xl border border-line text-muted text-sm font-medium cursor-pointer hover:border-red-300 hover:text-red-500 transition-colors"
                >
                  Send to Reclaim
                </button>
              )}
            </div>

            {error && <p className="px-5 py-2 text-red-600 text-xs">{error}</p>}
          </main>
        </div>
      </div>

      {/* Advance stage sheet */}
      <BottomSheet
        open={showAdvanceSheet}
        onClose={() => { setShowAdvanceSheet(false); setAdvanceTargetStage(null); setAdvanceFiles([]); setAdvancePreviews([]); setGlazeQuery('') }}
        title="Move to Stage"
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted mb-1.5">Select stage</label>
            <div className="flex flex-col gap-2">
              {STAGES.map((s) => (
                <button
                  key={s}
                  onClick={() => setAdvanceTargetStage(s)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-colors cursor-pointer hover:bg-surface-warm-hover ${advanceTargetStage === s
                      ? 'bg-surface-warm border-line-strong text-ink font-semibold'
                      : 'border-line text-ink-soft'
                    }`}
                >
                  <span className={`w-3 h-3 rounded-full flex-shrink-0 ${s === 'finished' ? 'bg-stage-complete' : 'bg-clay'
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
          {(advanceTargetStage === 'glazed' || advanceTargetStage === 'finished') && (
            <div>
              <label className="block text-xs uppercase tracking-widest text-muted mb-1.5">Glaze (optional)</label>
              <GlazePicker
                glazeTags={glazeTags}
                glazeIndex={glazeIndex}
                glazeCatalog={glazeCatalog}
                glazeQuery={glazeQuery}
                setGlazeQuery={setGlazeQuery}
                onToggle={handleTagToggle}
                onAddCustom={handleAddCustomGlaze}
                addingGlaze={addingGlaze}
                tagColors={tagColors}
              />
            </div>
          )}
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted mb-1.5">Photo (optional)</label>
            <PhotoPickerField
              files={advanceFiles}
              previews={advancePreviews}
              setFiles={setAdvanceFiles}
              setPreviews={setAdvancePreviews}
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted mb-1.5">Note (optional)</label>
            <textarea
              className="w-full border border-line rounded-xl px-3 py-2 text-sm text-ink bg-surface-warm resize-none"
              rows={3}
              placeholder="Any notes about this stage…"
              value={advanceNote}
              onChange={(e) => setAdvanceNote(e.target.value)}
            />
          </div>
          <div className="sticky bottom-0 -mx-4 px-4 pt-3 pb-safe bg-surface-raised border-t border-line">
            <button
              onClick={handleAdvance}
              disabled={advancing || !advanceTargetStage}
              className="w-full bg-clay text-white font-semibold py-3 rounded-2xl active:bg-clay-dark disabled:opacity-50 cursor-pointer hover:bg-clay-dark"
            >
              {advancing ? 'Saving…' : `Confirm${advanceTargetStage ? ` move to ${STAGE_LABELS[advanceTargetStage]}` : ''}`}
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Tag sheet */}
      <BottomSheet
        open={showTagSheet}
        onClose={() => { setShowTagSheet(false); setTagSearch({ form: '', glaze: '' }); setManageMode(false); setGlazeQuery('') }}
        title="Edit details"
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between -mt-2">
            <p className="text-[11px] text-muted/80">
              {manageMode ? 'Tap a custom tag to rename or delete.' : ''}
            </p>
            <button
              onClick={() => setManageMode(m => !m)}
              className="text-xs uppercase tracking-widest text-clay font-semibold cursor-pointer hover:text-clay-dark px-2 py-1"
            >
              {manageMode ? 'Done' : 'Manage'}
            </button>
          </div>
          {Object.entries(PRESET_TAGS).filter(([category]) => category !== 'glaze').map(([category, presetNames], categoryIdx) => {
            const customNames = userTags
              .filter(t => t.category === category && !presetNames.includes(t.name))
              .map(t => t.name)
            const allNames = [...presetNames, ...customNames]
            const showSearch = allNames.length > 10
            const query = tagSearch[category] || ''
            const filteredNames = query
              ? allNames.filter(n => n.toLowerCase().includes(query.toLowerCase()))
              : allNames
            const subtitle = category === 'form' ? 'Shape & function' : 'Surface & color'
            const heading = category === 'form' ? 'Form' : category === 'glaze' ? 'Glaze' : category
            return (
              <div key={category} className={categoryIdx > 0 ? 'pt-4 border-t border-line' : ''}>
                <p className="text-xs uppercase tracking-widest text-muted">{heading}</p>
                <p className="mt-1 text-[11px] text-muted/80 mb-2">{subtitle}</p>
                {showSearch && (
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setTagSearch(prev => ({ ...prev, [category]: e.target.value }))}
                    placeholder="Search…"
                    className="w-full mb-2 px-3 py-2 text-sm rounded-xl bg-surface-warm border border-line focus:border-clay/60 focus:outline-none"
                  />
                )}
                <div className="flex flex-wrap gap-2">
                  {!manageMode && (
                    <button
                      onClick={() => {
                        setAddTagCategory(category)
                        setAddTagName('')
                        setAddTagColor(category === 'glaze' ? '#4a7c59' : '#78350f')
                        setTagColorManuallySet(false)
                        setShowAddTagSheet(true)
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-dashed border-line-strong text-muted text-sm font-medium active:opacity-70 cursor-pointer hover:border-clay hover:text-ink-soft"
                    >
                      + Add
                    </button>
                  )}
                  {filteredNames.map((name) => {
                    const isSelected = tags.some((t) => t.name === name)
                    const isPreset = presetNames.includes(name)
                    return (
                      <div
                        key={name}
                        className={manageMode && isPreset ? 'opacity-40 pointer-events-none' : ''}
                      >
                        <TagChip
                          tag={{ id: name, name, category }}
                          selected={isSelected}
                          color={userTags.find(t => t.name === name)?.color || tagColors[name]}
                          onToggle={
                            manageMode
                              ? (isPreset ? undefined : () => openEditTag(name, category))
                              : () => handleTagToggle(name, category)
                          }
                        />
                      </div>
                    )
                  })}
                  {filteredNames.length === 0 && (
                    <p className="text-muted text-xs py-1">No matches.</p>
                  )}
                </div>
              </div>
            )
          })}
          {/* Glaze — catalog search & select (+ add custom) */}
          <div className="pt-4 border-t border-line">
            <p className="text-xs uppercase tracking-widest text-muted">Glaze</p>
            <p className="mt-1 text-[11px] text-muted/80 mb-2">Search & select from your catalog</p>

            <GlazePicker
              glazeTags={glazeTags}
              glazeIndex={glazeIndex}
              glazeCatalog={glazeCatalog}
              glazeQuery={glazeQuery}
              setGlazeQuery={setGlazeQuery}
              onToggle={handleTagToggle}
              onAddCustom={handleAddCustomGlaze}
              addingGlaze={addingGlaze}
              tagColors={tagColors}
            />
          </div>

          <p className="text-muted text-xs text-center min-h-[1rem]">
            {togglingTag ? 'Saving…' : ' '}
          </p>
        </div>
      </BottomSheet>

      {/* Clay detail (opened from the read-only Clay Body section) — read-only catalog */}
      <BottomSheet
        open={!!selectedClay}
        onClose={() => setSelectedClay(null)}
        title={selectedClay?.name}
      >
        <ClayDetail
          clay={selectedClay}
          favorite={selectedClay ? clayFaves.has(selectedClay.id) : false}
          onToggleFavorite={handleToggleClay}
        />
      </BottomSheet>

      {/* Glaze detail (opened from the read-only Glaze section) */}
      <BottomSheet
        open={!!selectedGlaze}
        onClose={() => { setSelectedGlaze(null); setGlazeSaveError(null) }}
        title={selectedGlaze?.name}
      >
        <GlazeDetail
          key={selectedGlaze?.id || 'none'}
          glaze={selectedGlaze}
          favorite={selectedGlaze ? glazeFaves.has(selectedGlaze.id) : false}
          onToggleFavorite={handleToggleGlaze}
          editable={!!selectedGlaze?.user_id && selectedGlaze.user_id === user.id}
          onSave={handleSaveGlaze}
          saving={glazeSaving}
          saveError={glazeSaveError}
        />
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
            <label className="block text-xs uppercase tracking-widest text-muted mb-1.5">Name</label>
            <input
              className="w-full border border-line rounded-xl px-3 py-2.5 text-sm bg-surface-warm text-ink"
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
            <label className="block text-xs uppercase tracking-widest text-muted mb-2">Color</label>
            <div className="flex items-center gap-3">
              <label className="relative cursor-pointer flex-shrink-0">
                <div
                  className="w-11 h-11 rounded-full border-2 border-line shadow-inner"
                  style={{ backgroundColor: addTagColor }}
                />
                <input
                  type="color"
                  value={addTagColor}
                  onChange={(e) => { setAddTagColor(e.target.value); setTagColorManuallySet(true) }}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                />
              </label>
              <span className="text-sm text-muted">Tap to open color wheel</span>
            </div>
          </div>

          {/* Recent colors */}
          {recentColors.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-widest text-muted mb-2">Recent</p>
              <div className="flex gap-2 flex-wrap">
                {recentColors.map((hex) => (
                  <button
                    key={hex}
                    className={`w-8 h-8 rounded-full border-2 transition-transform active:scale-95 cursor-pointer hover:scale-110 ${addTagColor === hex ? 'border-ink-soft scale-110' : 'border-transparent'}`}
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
              <span className="text-xs text-muted uppercase tracking-widest">Preview</span>
              <TagChip tag={{ id: '__preview', name: addTagName.trim(), category: addTagCategory }} selected color={addTagColor} />
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleAddCustomTag}
            disabled={!addTagName.trim() || !!togglingTag}
            className="w-full bg-clay text-white font-semibold py-3 rounded-2xl active:bg-clay-dark disabled:opacity-40 cursor-pointer hover:bg-clay-dark"
          >
            {togglingTag ? 'Saving…' : 'Add tag'}
          </button>
        </div>
      </BottomSheet>

      {/* Edit tag sheet (rename / recolor / delete) */}
      <BottomSheet
        open={!!editingTag}
        onClose={closeEditTag}
        title={editingTag ? `Edit "${editingTag.name}"` : 'Edit tag'}
        zClassName="z-60"
      >
        {editingTag && (() => {
          const trimmed = editTagName.trim().toLowerCase()
          const presetCollision = PRESET_TAGS[editingTag.category].includes(trimmed) && trimmed !== editingTag.name
          const nameChanged = !!trimmed && trimmed !== editingTag.name
          const colorChanged = editTagColor !== (editingTag.color || '')
          const canSave = !!trimmed && !presetCollision && (nameChanged || colorChanged)
          return (
            <div className="flex flex-col gap-5">
              {/* Name */}
              <div>
                <label className="block text-xs uppercase tracking-widest text-muted mb-1.5">Name</label>
                <input
                  className="w-full border border-line rounded-xl px-3 py-2.5 text-sm bg-surface-warm text-ink"
                  value={editTagName}
                  autoFocus
                  onChange={(e) => {
                    const val = e.target.value
                    setEditTagName(val)
                    if (!editTagManuallySet) {
                      const detected = detectColor(val)
                      if (detected) setEditTagColor(detected)
                    }
                  }}
                />
                {presetCollision && (
                  <p className="text-red-500 text-xs mt-1.5">"{trimmed}" is a built-in tag. Choose a different name.</p>
                )}
              </div>

              {/* Color picker */}
              <div>
                <label className="block text-xs uppercase tracking-widest text-muted mb-2">Color</label>
                <div className="flex items-center gap-3">
                  <label className="relative cursor-pointer flex-shrink-0">
                    <div
                      className="w-11 h-11 rounded-full border-2 border-line shadow-inner"
                      style={{ backgroundColor: editTagColor }}
                    />
                    <input
                      type="color"
                      value={editTagColor}
                      onChange={(e) => { setEditTagColor(e.target.value); setEditTagManuallySet(true) }}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                  </label>
                  <span className="text-sm text-muted">Tap to open color wheel</span>
                </div>
              </div>

              {/* Recent colors */}
              {recentColors.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted mb-2">Recent</p>
                  <div className="flex gap-2 flex-wrap">
                    {recentColors.map((hex) => (
                      <button
                        key={hex}
                        className={`w-8 h-8 rounded-full border-2 transition-transform active:scale-95 cursor-pointer hover:scale-110 ${editTagColor === hex ? 'border-ink-soft scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: hex }}
                        onClick={() => { setEditTagColor(hex); setEditTagManuallySet(true) }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Preview */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted uppercase tracking-widest">Preview</span>
                <TagChip
                  tag={{ id: '__preview', name: trimmed || editingTag.name, category: editingTag.category }}
                  selected
                  color={editTagColor}
                />
              </div>

              {editTagError && (
                <p className="text-red-500 text-xs text-center">{editTagError}</p>
              )}

              {/* Save */}
              <button
                onClick={handleSaveEditTag}
                disabled={!canSave || editTagSaving}
                className="w-full bg-clay text-white font-semibold py-3 rounded-2xl active:bg-clay-dark disabled:opacity-40 cursor-pointer hover:bg-clay-dark"
              >
                {editTagSaving ? 'Saving…' : 'Save'}
              </button>

              {/* Delete */}
              <button
                onClick={handleOpenDeleteTagConfirm}
                disabled={editTagSaving}
                className="w-full text-red-500 font-semibold py-2 cursor-pointer hover:text-red-700 disabled:opacity-40"
              >
                Delete tag
              </button>
            </div>
          )
        })()}
      </BottomSheet>

      {/* Delete tag confirmation */}
      <BottomSheet
        open={showDeleteTagConfirm}
        onClose={() => { setShowDeleteTagConfirm(false); setTagDeleteCount(null) }}
        title={editingTag ? `Delete "${editingTag.name}"?` : 'Delete tag?'}
        zClassName="z-[70]"
      >
        <div className="flex flex-col gap-3 pb-2">
          <p className="text-sm text-muted">
            {tagDeleteCount === null && 'Checking how many pieces use this tag…'}
            {tagDeleteCount === 0 && "This tag isn't on any piece. It'll be removed from your tag list."}
            {tagDeleteCount === 1 && (
              <>This tag is currently on <span className="font-semibold text-ink">1 piece</span>. It'll be removed from that piece and from your tag list.</>
            )}
            {typeof tagDeleteCount === 'number' && tagDeleteCount > 1 && (
              <>This tag is currently on <span className="font-semibold text-ink">{tagDeleteCount} pieces</span>. It'll be removed from each of them and from your tag list.</>
            )}
          </p>
          <button
            onClick={handleDeleteEditTag}
            disabled={editTagSaving}
            className="w-full bg-red-500 text-white font-semibold py-3.5 rounded-2xl active:bg-red-600 disabled:opacity-50 cursor-pointer hover:bg-red-600"
          >
            {editTagSaving ? 'Deleting…' : 'Yes, delete tag'}
          </button>
          <button
            onClick={() => { setShowDeleteTagConfirm(false); setTagDeleteCount(null) }}
            className="w-full bg-surface-warm text-ink-soft font-semibold py-3.5 rounded-2xl active:bg-surface-warm-hover cursor-pointer hover:bg-surface-warm-hover"
          >
            Cancel
          </button>
        </div>
      </BottomSheet>

      {/* Edit photos sheet */}
      <BottomSheet
        open={showAddPhotoSheet}
        onClose={() => { setShowAddPhotoSheet(false); setAddPhotoFiles([]); setAddPhotoPreviews([]); setAddPhotoNote(''); setSelectedPhotoIds(new Set()) }}
        title="Edit Photos"
      >
        <div className="flex flex-col gap-5">
          {/* Existing photos — multi-select to delete */}
          {photos.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-widest text-muted">
                  Current photos ({photos.length})
                </p>
                {selectedPhotoIds.size > 0 && (
                  <button
                    onClick={() => setSelectedPhotoIds(new Set())}
                    className="text-xs text-muted cursor-pointer hover:text-ink-soft"
                  >
                    Clear selection
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((p, i) => {
                  const selected = selectedPhotoIds.has(p.id)
                  const url = photoUrls[i]
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePhotoSelected(p.id)}
                      className={`relative aspect-square rounded-xl overflow-hidden bg-surface-warm cursor-pointer hover:opacity-90 active:opacity-80 ${selected ? 'ring-2 ring-clay' : ''}`}
                      aria-pressed={selected}
                    >
                      {url ? (
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-surface-warm-hover" />
                      )}
                      <div className={`absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center transition-colors ${selected ? 'bg-clay text-white' : 'bg-white/80 text-transparent border border-line-strong'}`}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 6l3 3 5-5" />
                        </svg>
                      </div>
                      {selected && <div className="absolute inset-0 bg-clay/15 pointer-events-none" />}
                    </button>
                  )
                })}
              </div>
              {selectedPhotoIds.size > 0 && (
                <button
                  onClick={() => setShowDeletePhotosConfirm(true)}
                  disabled={deletingPhotos}
                  className="w-full bg-red-500 text-white font-semibold py-2.5 rounded-xl active:bg-red-600 disabled:opacity-50 cursor-pointer hover:bg-red-600 text-sm"
                >
                  Delete {selectedPhotoIds.size} {selectedPhotoIds.size === 1 ? 'photo' : 'photos'}
                </button>
              )}
            </div>
          )}

          {photos.length > 0 && (
            <div className="border-t border-line -mx-4" />
          )}

          {/* Add new photos */}
          <p className="text-xs uppercase tracking-widest text-muted">Add new photos</p>
          <PhotoPickerField
            files={addPhotoFiles}
            previews={addPhotoPreviews}
            setFiles={setAddPhotoFiles}
            setPreviews={setAddPhotoPreviews}
          />

          <div>
            <p className="text-xs uppercase tracking-widest text-muted mb-1.5">Tag with stage (optional)</p>
            <div className="flex flex-wrap gap-2">
              {STAGES.map((s) => (
                <button
                  key={s}
                  onClick={() => setAddPhotoStage(addPhotoStage === s ? null : s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${addPhotoStage === s
                      ? 'bg-clay text-white border-clay hover:bg-clay-dark'
                      : 'bg-surface-raised text-ink-soft border-line hover:bg-surface-warm'
                    }`}
                >
                  {STAGE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-muted mb-1.5">Note (optional)</label>
            <textarea
              className="w-full border border-line rounded-xl px-3 py-2 text-sm text-ink bg-surface-warm resize-none"
              rows={2}
              placeholder="Any notes about this photo…"
              value={addPhotoNote}
              onChange={(e) => setAddPhotoNote(e.target.value)}
            />
          </div>

          {addPhotoFiles.length > 0 && (
            <button
              onClick={handleAddPhoto}
              disabled={addingPhoto}
              className="w-full bg-clay text-white font-semibold py-3 rounded-2xl active:bg-clay-dark disabled:opacity-50 cursor-pointer hover:bg-clay-dark"
            >
              {addingPhoto ? 'Uploading…' : `Upload ${addPhotoFiles.length} ${addPhotoFiles.length === 1 ? 'photo' : 'photos'}`}
            </button>
          )}
        </div>
      </BottomSheet>

      {/* Delete photos confirmation sheet (stacked above edit-photos sheet) */}
      <BottomSheet
        open={showDeletePhotosConfirm}
        onClose={() => setShowDeletePhotosConfirm(false)}
        title={`Delete ${selectedPhotoIds.size} ${selectedPhotoIds.size === 1 ? 'photo' : 'photos'}?`}
        zClassName="z-[60]"
      >
        <div className="flex flex-col gap-3 pb-2">
          <p className="text-sm text-muted">
            This permanently removes {selectedPhotoIds.size === 1 ? 'it' : 'them'} from this piece. This cannot be undone.
          </p>
          <button
            onClick={handleBulkDeletePhotos}
            disabled={deletingPhotos}
            className="w-full bg-red-500 text-white font-semibold py-3.5 rounded-2xl active:bg-red-600 disabled:opacity-50 cursor-pointer hover:bg-red-600"
          >
            {deletingPhotos ? 'Deleting…' : 'Yes, delete'}
          </button>
          <button
            onClick={() => setShowDeletePhotosConfirm(false)}
            disabled={deletingPhotos}
            className="w-full bg-surface-warm text-ink-soft font-semibold py-3.5 rounded-2xl active:bg-surface-warm-hover disabled:opacity-50 cursor-pointer hover:bg-surface-warm-hover"
          >
            Cancel
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
                <button
                  onClick={(e) => { e.stopPropagation(); setShowEditStageSheet(true) }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm active:bg-white/25 cursor-pointer hover:bg-white/25"
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${photos[viewerIndex].stage === 'finished' ? 'bg-stage-complete' : 'bg-clay'
                    }`} />
                  <span className="text-white text-xs font-medium">{STAGE_LABELS[photos[viewerIndex].stage]}</span>
                  <span className="text-white/70 text-xs leading-none">›</span>
                </button>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowEditStageSheet(true) }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-sm active:bg-white/20 cursor-pointer hover:bg-white/20"
                >
                  <span className="text-white/60 text-xs">No stage tagged</span>
                  <span className="text-white/50 text-xs leading-none">›</span>
                </button>
              )}
            </div>
            <button
              onClick={() => setViewerOpen(false)}
              className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-white text-xl leading-none active:bg-white/30 cursor-pointer hover:bg-white/30"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Photo — swipeable / pinch-zoomable / pannable */}
          <div
            className="flex-1 flex items-center justify-center overflow-hidden cursor-zoom-in"
            style={{ touchAction: 'none' }}
            onTouchStart={handleViewerTouchStart}
            onTouchMove={handleViewerTouchMove}
            onTouchEnd={handleViewerTouchEnd}
            onTouchCancel={handleViewerTouchEnd}
            onClick={handleViewerClick}
          >
            {photoUrls[viewerIndex] ? (
              <img
                src={photoUrls[viewerIndex]}
                alt=""
                draggable={false}
                className="max-w-full max-h-full object-contain select-none"
                style={{
                  transform: `translate3d(${zoomTranslate.x}px, ${zoomTranslate.y}px, 0) scale(${zoomScale})`,
                  transformOrigin: 'center center',
                  transition: lightboxGesturing ? 'none' : 'transform 180ms ease-out',
                  willChange: 'transform',
                }}
              />
            ) : (
              <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          {/* Bottom bar: note + counter */}
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
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-colors disabled:opacity-50 cursor-pointer hover:bg-surface-warm-hover ${!photos[viewerIndex]?.stage
                ? 'bg-surface-warm border-line-strong text-ink font-semibold'
                : 'border-line text-muted'
              }`}
          >
            <span className="w-3 h-3 rounded-full border-2 border-line-strong flex-shrink-0" />
            <span className="text-sm">No stage</span>
          </button>
          {STAGES.map((s) => (
            <button
              key={s}
              onClick={() => handleEditStage(photos[viewerIndex]?.id, s)}
              disabled={savingStage}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-colors disabled:opacity-50 cursor-pointer hover:bg-surface-warm-hover ${photos[viewerIndex]?.stage === s
                  ? 'bg-surface-warm border-line-strong text-ink font-semibold'
                  : 'border-line text-ink-soft'
                }`}
            >
              <span className={`w-3 h-3 rounded-full flex-shrink-0 ${s === 'finished' ? 'bg-stage-complete' : 'bg-clay'
                }`} />
              <span className="text-sm">{STAGE_LABELS[s]}</span>
            </button>
          ))}
          {savingStage && <p className="text-center text-xs text-muted">Saving…</p>}
        </div>
      </BottomSheet>

      {/* Edit piece sheet */}
      <BottomSheet
        open={showEditPieceSheet}
        onClose={() => setShowEditPieceSheet(false)}
        title="Edit piece"
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted mb-1.5">Name</label>
            <input
              className="w-full border border-line rounded-xl px-4 py-3 text-sm text-ink bg-surface-warm"
              placeholder="e.g. Curved mug"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted mb-1.5">Clay body</label>
            <ClayBodyPicker value={editClayBody} onChange={setEditClayBody} userId={user.id} active={showEditPieceSheet} />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted mb-1.5">Current stage</label>
            <div className="flex flex-col gap-2">
              {STAGES.map((s) => (
                <button
                  key={s}
                  onClick={() => setEditStage(s)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-colors cursor-pointer hover:bg-surface-warm-hover ${editStage === s
                      ? 'bg-surface-warm border-line-strong text-ink font-semibold'
                      : 'border-line text-ink-soft'
                    }`}
                >
                  <span className={`w-3 h-3 rounded-full flex-shrink-0 ${s === 'finished' ? 'bg-stage-complete' : 'bg-clay'
                    }`} />
                  <span className="text-sm flex-1 text-left">{STAGE_LABELS[s]}</span>
                  {editStage === s && (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8l4 4 6-6" stroke="#78350f" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted mb-1.5">Date started</label>
            <input
              type="date"
              className="w-full border border-line rounded-xl px-4 py-3 text-sm text-ink bg-surface-warm"
              value={editCreatedAt}
              onChange={(e) => setEditCreatedAt(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted mb-1.5">Notes</label>
            <textarea
              className="w-full border border-line rounded-xl px-4 py-2 text-sm text-ink bg-surface-warm resize-none"
              rows={3}
              placeholder="Any details about this piece…"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
            />
          </div>
          <button
            onClick={handleSavePiece}
            disabled={savingPiece || !editName.trim()}
            className="w-full bg-clay text-white font-semibold py-3 rounded-2xl active:bg-clay-dark disabled:opacity-50 cursor-pointer hover:bg-clay-dark"
          >
            {savingPiece ? 'Saving…' : 'Save'}
          </button>
        </div>
      </BottomSheet>

      {/* Edit note sheet */}
      <BottomSheet
        open={showNoteSheet}
        onClose={() => { setShowNoteSheet(false); setNoteStage(null); setNoteText(''); setNoteDate('') }}
        title={noteStage ? `Note · ${STAGE_LABELS[noteStage]}` : 'Note'}
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted mb-1.5">Date</label>
            <input
              type="date"
              className="w-full border border-line rounded-xl px-3 py-2 text-sm text-ink bg-surface-warm"
              value={noteDate}
              onChange={(e) => setNoteDate(e.target.value)}
            />
          </div>
          <textarea
            className="w-full border border-line rounded-xl px-3 py-2 text-sm text-ink bg-surface-warm resize-none"
            rows={4}
            placeholder="Anything worth remembering about this stage…"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            autoFocus
          />
          <button
            onClick={handleSaveNote}
            disabled={savingNote}
            className="w-full bg-clay text-white font-semibold py-3 rounded-2xl active:bg-clay-dark disabled:opacity-50 cursor-pointer hover:bg-clay-dark"
          >
            {savingNote ? 'Saving…' : 'Save note'}
          </button>
        </div>
      </BottomSheet>

      {/* Gift confirmation */}
      <BottomSheet
        open={showMarkGiftedConfirm}
        onClose={() => setShowMarkGiftedConfirm(false)}
        title="Gift this piece?"
      >
        <div className="flex flex-col gap-3 pb-2">
          <p className="text-sm text-muted">
            This piece will move to your Gifted collection and be hidden from the board.
          </p>
          <button
            onClick={handleMarkGifted}
            disabled={markingGifted}
            className="w-full bg-clay text-white font-semibold py-3.5 rounded-2xl active:bg-clay-dark disabled:opacity-50 cursor-pointer hover:bg-clay-dark"
          >
            {markingGifted ? 'Moving…' : 'Gift this piece'}
          </button>
          <button
            onClick={() => setShowMarkGiftedConfirm(false)}
            className="w-full bg-surface-warm text-ink-soft font-semibold py-3.5 rounded-2xl active:bg-surface-warm-hover cursor-pointer hover:bg-surface-warm-hover"
          >
            Cancel
          </button>
        </div>
      </BottomSheet>

      {/* Send to Reclaim confirmation */}
      <BottomSheet
        open={showMarkLostConfirm}
        onClose={() => setShowMarkLostConfirm(false)}
        title="Send to Reclaim?"
      >
        <div className="flex flex-col gap-3 pb-2">
          <p className="text-sm text-muted">
            This piece will move to the Reclaim page. You can still view it and delete it from there.
          </p>
          <button
            onClick={handleMarkLost}
            disabled={markingLost}
            className="w-full bg-clay text-white font-semibold py-3.5 rounded-2xl active:bg-clay-dark disabled:opacity-50 cursor-pointer hover:bg-clay-dark"
          >
            {markingLost ? 'Moving…' : 'Send to Reclaim'}
          </button>
          <button
            onClick={() => setShowMarkLostConfirm(false)}
            className="w-full bg-surface-warm text-ink-soft font-semibold py-3.5 rounded-2xl active:bg-surface-warm-hover cursor-pointer hover:bg-surface-warm-hover"
          >
            Cancel
          </button>
        </div>
      </BottomSheet>
    </>
  )
}

// Shared catalog glaze search/select used by both the Edit-details sheet and the
// Advance sheet (Glazed/Finished). Selected chips (removable) + search input +
// result rows + an "Add as custom" affordance. Selecting/removing writes the
// glaze tag immediately via onToggle, so chips persist independent of any sheet.
function GlazePicker({ glazeTags, glazeIndex, glazeCatalog, glazeQuery, setGlazeQuery, onToggle, onAddCustom, addingGlaze, tagColors }) {
  const selectedNames = new Set(glazeTags.map(t => t.name))
  const q = glazeQuery.trim().toLowerCase()
  const results = glazeCatalog
    .filter(g => !selectedNames.has((g.name || '').toLowerCase()))
    .filter(g => !q || `${g.name} ${g.family || ''}`.toLowerCase().includes(q))
    .slice(0, 50)
  const exactMatch =
    glazeCatalog.some(g => (g.name || '').toLowerCase() === q) || selectedNames.has(q)
  const canAddCustom = q.length > 0 && !exactMatch

  return (
    <>
      {glazeTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {glazeTags.map((tag) => {
            const g = matchGlaze(glazeIndex, tag.name)
            return (
              <TagChip
                key={tag.id}
                tag={{ id: tag.id, name: g?.name || tag.name, category: 'glaze' }}
                selected
                color={g?.hex_swatch || tag.color || tagColors[tag.name] || CATEGORY_DEFAULTS.glaze}
                onRemove={() => onToggle(tag.name, 'glaze')}
              />
            )
          })}
        </div>
      )}

      <input
        type="search"
        value={glazeQuery}
        onChange={(e) => setGlazeQuery(e.target.value)}
        placeholder="Search glazes…"
        className="w-full mb-2 px-3 py-2 text-sm rounded-xl bg-surface-warm border border-line focus:border-clay/60 focus:outline-none"
      />

      <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
        {results.map((g) => (
          <button
            key={g.id}
            onClick={() => onToggle((g.name || '').toLowerCase(), 'glaze', g.hex_swatch)}
            className="flex items-center gap-3 px-2 py-2 rounded-xl text-left cursor-pointer hover:bg-surface-warm-hover"
          >
            <span
              className="w-6 h-6 rounded-full border border-line shrink-0"
              style={{ backgroundColor: g.hex_swatch || '#d4c5b0' }}
            />
            <span className="flex-1 min-w-0 truncate">
              <span className="text-sm text-ink">{g.name}</span>
              {g.family && <span className="text-[11px] text-muted ml-2">{g.family}</span>}
            </span>
            {g.user_id && (
              <span className="text-[10px] uppercase tracking-wider text-clay">custom</span>
            )}
          </button>
        ))}
        {canAddCustom && (
          <button
            onClick={() => onAddCustom(glazeQuery)}
            disabled={addingGlaze}
            className="flex items-center gap-2 px-2 py-2 rounded-xl text-left text-sm font-medium text-clay cursor-pointer hover:bg-surface-warm-hover disabled:opacity-50"
          >
            {addingGlaze ? 'Adding…' : `+ Add "${glazeQuery.trim()}" as custom glaze`}
          </button>
        )}
        {results.length === 0 && !canAddCustom && (
          <p className="text-muted text-xs py-1">No matches.</p>
        )}
      </div>
    </>
  )
}

// Shared photo upload affordance for both the Advance and Edit Photos sheets.
// Empty state is a tappable camera card; once files are picked it shows a
// preview grid with per-item removal plus a dashed "+" tile to add more.
function PhotoPickerField({ files, previews, setFiles, setPreviews }) {
  function addFiles(e) {
    const incoming = Array.from(e.target.files)
    if (!incoming.length) return
    setFiles(prev => [...prev, ...incoming])
    setPreviews(prev => [...prev, ...incoming.map(f => URL.createObjectURL(f))])
    e.target.value = ''
  }
  function removeAt(i) {
    setFiles(prev => prev.filter((_, j) => j !== i))
    setPreviews(prev => prev.filter((_, j) => j !== i))
  }

  if (previews.length === 0) {
    return (
      <label className="block w-full h-40 rounded-2xl overflow-hidden bg-surface-warm cursor-pointer hover:bg-surface-warm-hover transition-colors active:opacity-80 flex-shrink-0">
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          <span className="text-sm">Tap to add photos</span>
        </div>
        <input type="file" accept="image/*,image/heic,image/heif" multiple className="hidden" onChange={addFiles} />
      </label>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {previews.map((src, i) => (
        <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-surface-warm">
          <img src={src} alt="" className="w-full h-full object-cover" />
          <button
            onClick={() => removeAt(i)}
            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center text-white text-sm leading-none cursor-pointer hover:bg-black/70"
            aria-label="Remove photo"
          >×</button>
        </div>
      ))}
      <label className="aspect-square rounded-xl border-2 border-dashed border-line-strong flex items-center justify-center cursor-pointer hover:border-clay hover:bg-surface-warm transition-colors">
        <span className="text-muted text-2xl leading-none">+</span>
        <input type="file" accept="image/*,image/heic,image/heif" multiple className="hidden" onChange={addFiles} />
      </label>
    </div>
  )
}

function PiecePreview({ preview }) {
  return (
    <div className="flex flex-col min-h-screen bg-surface">
      <div className="relative h-[40vh] flex-shrink-0 bg-tan overflow-hidden">
        {preview.thumbUrl ? (
          <img src={preview.thumbUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <PotteryPlaceholder className="rounded-none" />
        )}
      </div>
      <div className="px-5 pt-5">
        <p className="text-xs uppercase tracking-widest text-muted mb-1">Piece</p>
        <h1 className="text-3xl font-semibold text-ink leading-tight">{preview.name}</h1>
        {preview.clayBody && (
          <p className="text-sm text-muted mt-1">{preview.clayBody}</p>
        )}
      </div>
    </div>
  )
}
