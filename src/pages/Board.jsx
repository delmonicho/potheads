import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { getPieces, getStageEventsForUser, markLost, markGifted, STAGES, STAGE_ACTIONS, STAGE_COLORS } from '../lib/pieces.js'
import { getCustomStages } from '../lib/stages.js'
import { buildActivityByDay, parseDayKey } from '../lib/calendar.js'
import { getPhotosForPieces, getPhotoUrls } from '../lib/photos.js'
import { getTagsForPieces, getOrCreateTag, addTagToPiece, getUserTags, PRESET_TAGS } from '../lib/tags.js'
import StageColumn, { PieceCard, GroupHeader } from '../components/StageColumn.jsx'
import AddPiece from '../components/AddPiece.jsx'
import BottomSheet from '../components/BottomSheet.jsx'
import SegmentedControl from '../components/SegmentedControl.jsx'
import { getTheme, setTheme, getDensity, setDensity, getCollapsedStages, setStageCollapsed } from '../lib/prefs.js'
import { isDevOwner } from '../lib/diagnostics.js'

function BookIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v16" />
      <path d="M20.001 19A2 2 0 0 0 22 17V5a2 2 0 0 0-1.999-2L16 3.002A5 5 0 0 0 12 5a5 5 0 0 0-4-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 1.999 2H8a5 5 0 0 1 4 2 5 5 0 0 1 4-2z" />
    </svg>
  )
}

function GiftIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  )
}

function BrokenVaseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {/* Left piece — outer left contour + rim + jagged break on right edge */}
      <path d="M10 3 L8 7 L11 12 L8 17 L9 21 L7 21 Q4 16 4 12 Q4 6 8 3 Z" />
      {/* Right piece shifted down+right — jagged break on left edge + outer right contour + rim */}
      <path d="M13 4 L11 8 L14 13 L11 18 L12 22 L17 22 Q20 17 20 13 Q20 7 16 4 Z" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
      <path d="M3 9h18M8 2.5v4M16 2.5v4" />
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
  const location = useLocation()
  // Day mode: which day's activity we're viewing. Seeded by navigation from the
  // calendar, then mutated locally by the prev/next-day stepper. We adjust the
  // day during render (React's "reset state on prop change" pattern) keyed on
  // location.key, so a fresh navigation re-seeds it while a local prev/next step
  // (same location.key) is preserved.
  const navDayKey = location.state?.dayKey ?? null
  const [dayState, setDayState] = useState({ key: navDayKey, navKey: location.key })
  let dayKey = dayState.key
  if (dayState.navKey !== location.key) {
    dayKey = navDayKey
    setDayState({ key: navDayKey, navKey: location.key })
  }
  const setDayKey = (k) => setDayState({ key: k, navKey: location.key })
  const [stageEvents, setStageEvents] = useState([])
  const [stageEventsLoaded, setStageEventsLoaded] = useState(false)
  const [pieces, setPieces] = useState([])
  const [thumbUrls, setThumbUrls] = useState({})  // pieceId → signed URL
  const [formTags, setFormTags] = useState({})     // pieceId → form tag name
  const [glazeTags, setGlazeTags] = useState({})   // pieceId → { name, color }
  const [allTagsByPiece, setAllTagsByPiece] = useState(new Map()) // pieceId → tags[]
  const [userTags, setUserTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAddPiece, setShowAddPiece] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [viewMode, setViewMode] = useState('stage') // 'stage' | 'clay_body' | 'glaze' | 'form'

  // Multi-select
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [showTagSheet, setShowTagSheet] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showGiftConfirm, setShowGiftConfirm] = useState(false)
  const [bulkSaving, setBulkSaving] = useState(false)

  const [theme, setThemeState] = useState(getTheme)
  const [density, setDensityState] = useState(getDensity)
  const handleThemeChange = (t) => { setThemeState(t); setTheme(t) }
  const handleDensityChange = (d) => { setDensityState(d); setDensity(d) }
  const gridCols = density === 'comfortable' ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-3'

  const [studioName, setStudioName] = useState(user.user_metadata?.studio_name || '')
  const [editStudioName, setEditStudioName] = useState('')
  const [savingStudioName, setSavingStudioName] = useState(false)
  useEffect(() => { if (showProfile) setEditStudioName(studioName) }, [showProfile]) // eslint-disable-line react-hooks/exhaustive-deps

  const [customStages, setCustomStages] = useState([])
  const [collapsedStages, setCollapsedStages] = useState(getCollapsedStages)
  const handleToggleStageCollapsed = (stage) => {
    setCollapsedStages((prev) => {
      const next = { ...prev, [stage]: !prev[stage] }
      setStageCollapsed(stage, next[stage])
      return next
    })
  }

  const [collapsedGroups, setCollapsedGroups] = useState({})
  const toggleGroup = (key) => setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }))

  const fetchAll = useCallback(async () => {
    try {
      const data = await getPieces(user.id)
      setPieces(data)

      if (data.length === 0) {
        setStageEvents([])
        setStageEventsLoaded(true)
        return
      }

      const pieceIds = data.map(p => p.id)
      const [photosByPiece, tagsByPiece, allUserTags, events, customStageRows] = await Promise.all([
        getPhotosForPieces(pieceIds),
        getTagsForPieces(pieceIds),
        getUserTags(user.id),
        getStageEventsForUser(),
        getCustomStages(user.id),
      ])
      setCustomStages(customStageRows)
      setUserTags(allUserTags)
      setStageEvents(events)
      setStageEventsLoaded(true)

      // Derive form tag name + primary glaze tag (name+color) per piece
      const newFormTags = {}
      const newGlazeTags = {}
      for (const [pieceId, tags] of tagsByPiece) {
        const ft = tags.find(t => t.category === 'form')
        if (ft) newFormTags[pieceId] = ft.name
        const gt = tags.find(t => t.category === 'glaze')
        if (gt) newGlazeTags[pieceId] = { name: gt.name, color: gt.color }
      }
      setFormTags(newFormTags)
      setGlazeTags(newGlazeTags)
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

      // Sign all thumbnail URLs in one batched Storage request (cached after first load)
      const urlResults = await getPhotoUrls(thumbEntries.map(e => e.path)).catch(() => [])
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

  async function handleSaveStudioName() {
    const name = editStudioName.trim()
    setSavingStudioName(true)
    try {
      await supabase.auth.updateUser({ data: { studio_name: name || null } })
      setStudioName(name)
    } finally {
      setSavingStudioName(false)
    }
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

  async function handleBulkGift() {
    setBulkSaving(true)
    try {
      await Promise.all([...selectedIds].map(id => markGifted(id, true)))
      await fetchAll()
      exitSelectMode()
    } finally {
      setBulkSaving(false)
      setShowGiftConfirm(false)
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

  const activepieces = useMemo(() => pieces.filter(p => !p.lost), [pieces])

  const pieceById = useMemo(() => {
    const m = new Map()
    for (const p of pieces) m.set(p.id, p)
    return m
  }, [pieces])

  // Per-day activity, computed here (not passed in) so the day page can step
  // between days on its own. Only built in day mode, once stage events load.
  const activityByDay = useMemo(
    () => (dayKey && stageEventsLoaded ? buildActivityByDay(pieces, stageEvents) : null),
    [dayKey, stageEventsLoaded, pieces, stageEvents],
  )

  const dayEntry = activityByDay && dayKey ? activityByDay.get(dayKey) : null

  // Group the selected day's pieces by the *action* that happened that day
  // (Thrown / Bisque Ready / Glazed / Finished), not current stage. A piece with
  // two actions that day appears under both groups. Pieces are looked up from the
  // full list so historical activity shows even if the piece was later lost —
  // matching what the calendar counted.
  const dayActionGroups = useMemo(() => {
    if (!dayEntry) return []
    return STAGES
      .map(stage => {
        const groupPieces = []
        for (const [id, stages] of dayEntry.pieceActions) {
          if (stages.has(stage)) {
            const piece = pieceById.get(id)
            if (piece) groupPieces.push(piece)
          }
        }
        return { stage, label: STAGE_ACTIONS[stage], color: STAGE_COLORS[stage], pieces: groupPieces }
      })
      .filter(g => g.pieces.length > 0)
  }, [dayEntry, pieceById])

  const dayPieceCount = dayEntry ? dayEntry.pieceIds.size : 0

  // Days that have activity, chronological — the stepper hops between these,
  // skipping empty days. (YYYY-MM-DD keys sort lexicographically = by date.)
  const activeDayKeys = useMemo(
    () => (activityByDay ? [...activityByDay.keys()].sort() : []),
    [activityByDay],
  )
  const dayIdx = dayKey ? activeDayKeys.indexOf(dayKey) : -1
  const prevDayKey = dayIdx > 0 ? activeDayKeys[dayIdx - 1] : null
  const nextDayKey = dayIdx >= 0 && dayIdx < activeDayKeys.length - 1 ? activeDayKeys[dayIdx + 1] : null

  const dayDate = dayKey ? parseDayKey(dayKey) : null
  const dayLabel = dayDate
    ? dayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : ''

  function backToCalendar() {
    if (!dayDate) return navigate('/calendar')
    navigate('/calendar', { state: { year: dayDate.getFullYear(), month: dayDate.getMonth() } })
  }

  const allStages = useMemo(
    () => [...STAGES, ...customStages.map(s => s.name)],
    [customStages]
  )

  const piecesByStage = useMemo(
    () => allStages.reduce((acc, stage) => {
      acc[stage] = activepieces.filter(p => p.current_stage === stage)
      return acc
    }, {}),
    [activepieces, allStages]
  )

  // Latest stage-event timestamp per piece, for the "advanced on <date>" label
  // on board cards. Falls back to the piece's created_at when its current
  // stage is the one it started in (advanceStage only writes a stage_events
  // row on transitions, never for the initial stage).
  const stageDates = useMemo(() => {
    const eventsByPiece = new Map()
    for (const ev of stageEvents) {
      if (!eventsByPiece.has(ev.piece_id)) eventsByPiece.set(ev.piece_id, [])
      eventsByPiece.get(ev.piece_id).push(ev)
    }
    const map = {}
    for (const piece of pieces) {
      const events = eventsByPiece.get(piece.id) || []
      const match = events.find(ev => ev.stage === piece.current_stage)
      map[piece.id] = match?.moved_at || piece.created_at || null
    }
    return map
  }, [pieces, stageEvents])

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

  const formGroups = useMemo(() => {
    const groups = new Map()
    for (const piece of activepieces) {
      const tags = allTagsByPiece.get(piece.id) || []
      const ft = tags.find(t => t.category === 'form' && t.name !== 'lost')
      const key = ft ? ft.name : '__none'
      const label = ft ? ft.name : 'No form'
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
  }, [activepieces, allTagsByPiece])

  const userInitial = (user.user_metadata?.full_name || user.email || '?')[0].toUpperCase()

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      {/* Header */}
      <header className="px-5 compact:px-4 pt-safe bg-surface sticky top-0 z-10 border-b border-line/70">
        <div className="flex items-center justify-between pt-3 pb-1">
          <p className="text-xs uppercase tracking-widest text-muted">
            {studioName || 'Studio'} · {activepieces.length} {activepieces.length === 1 ? 'piece' : 'pieces'}
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
                className="text-muted active:text-ink-soft cursor-pointer hover:text-ink-soft"
                aria-label="Select pieces"
              >
                <SelectIcon />
              </button>
            )}
            <button
              onClick={() => navigate('/calendar')}
              className="text-muted active:text-ink-soft cursor-pointer hover:text-ink-soft"
              aria-label="Calendar"
            >
              <CalendarIcon />
            </button>
            <button
              onClick={() => navigate('/catalog')}
              className="text-muted active:text-ink-soft cursor-pointer hover:text-ink-soft"
              aria-label="Catalog"
            >
              <BookIcon />
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
        <div className={`flex justify-between ${dayKey ? 'items-center pb-2' : 'items-baseline pb-3'}`}>
          {dayKey ? (
            <>
              <button
                onClick={backToCalendar}
                className="flex items-center gap-1 text-xs uppercase tracking-widest text-clay font-semibold cursor-pointer hover:text-clay-dark"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                Calendar
              </button>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => prevDayKey && setDayKey(prevDayKey)}
                  disabled={!prevDayKey}
                  aria-label="Previous active day"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:bg-clay-tint hover:text-ink-soft cursor-pointer disabled:opacity-30 disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-muted"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                </button>
                <span className="font-display italic text-xl text-ink text-center min-w-30">{dayLabel}</span>
                <button
                  onClick={() => nextDayKey && setDayKey(nextDayKey)}
                  disabled={!nextDayKey}
                  aria-label="Next active day"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:bg-clay-tint hover:text-ink-soft cursor-pointer disabled:opacity-30 disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-muted"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 className="font-display italic text-4xl text-ink">Potheads.</h1>
              <div className="relative flex items-center gap-1.5">
                <span className="text-xs font-semibold text-muted">Sort by</span>
                <select
                  value={viewMode}
                  onChange={e => setViewMode(e.target.value)}
                  className="appearance-none text-xs font-semibold text-clay bg-transparent border-none cursor-pointer pr-4 focus:outline-none"
                >
                  <option value="stage">Stage</option>
                  <option value="clay_body">Clay Body</option>
                  <option value="glaze">Glaze</option>
                  <option value="form">Form</option>
                </select>
                <svg className="pointer-events-none absolute right-0 text-clay" width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  <path d="M0 3l5 5 5-5H0z" />
                </svg>
              </div>
            </>
          )}
        </div>
        {dayKey && (
          <div className="flex items-center gap-x-3 gap-y-1 flex-wrap pb-3">
            <span className="text-xs uppercase tracking-widest text-muted">
              {dayPieceCount} {dayPieceCount === 1 ? 'piece' : 'pieces'}
            </span>
            {dayActionGroups.map(({ stage, label, color, pieces: gp }) => (
              <span key={stage} className="flex items-center gap-1 text-[11px] text-muted">
                <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                {label} {gp.length}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* Main */}
      <main className="flex-1 overflow-y-auto px-4 compact:px-3 py-4 pb-36">
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-clay border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {error && (
          <p className="text-red-600 text-sm text-center py-4">{error}</p>
        )}
        {!loading && !error && !dayKey && pieces.length === 0 && (
          <div className="flex flex-col items-center pt-12 px-8 text-center">
            <div className="relative w-56 h-40 opacity-70">
              <img
                src="/placeholders/bowl.svg"
                alt=""
                className="absolute left-0 bottom-0 w-28 h-28 object-contain"
              />
              <img
                src="/placeholders/vase.svg"
                alt=""
                className="absolute left-1/2 -translate-x-1/2 top-0 w-32 h-36 object-contain"
              />
              <img
                src="/placeholders/mug.svg"
                alt=""
                className="absolute right-0 bottom-0 w-24 h-24 object-contain"
              />
            </div>
            <h2 className="font-display italic text-3xl text-ink mt-2">Your shelf is empty.</h2>
            <p className="text-sm text-muted max-w-xs mt-2">
              Throw your first piece — snap a photo and start the timeline.
            </p>
            <button
              onClick={() => setShowAddPiece(true)}
              className="bg-clay text-white py-3.5 px-6 rounded-2xl mt-6 w-full max-w-xs cursor-pointer hover:bg-clay-dark active:bg-clay-dark font-semibold"
            >
              Throw your first piece
            </button>
            <button
              onClick={() => navigate('/catalog')}
              className="text-xs uppercase tracking-widest text-muted mt-4 cursor-pointer hover:text-ink-soft"
            >
              Browse clays &amp; glazes first
            </button>
          </div>
        )}
        {!loading && !error && dayKey && !stageEventsLoaded && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-clay border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loading && !error && dayKey && stageEventsLoaded && dayActionGroups.map(({ stage, label, color, pieces: groupPieces }) => (
          <div key={stage} className="mb-8">
            <div className="flex items-baseline justify-between mb-3 border-b border-line pb-2">
              <h2 className="flex items-center gap-2 font-display italic text-2xl text-ink">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                {label}
              </h2>
              <span className="text-sm text-muted tabular-nums">{String(groupPieces.length).padStart(2, '0')}</span>
            </div>
            <div className={`grid ${gridCols} lg:grid-cols-5 gap-3 sm:gap-4`}>
              {groupPieces.map((piece) => (
                <PieceCard key={piece.id} piece={piece} thumbUrl={thumbUrls?.[piece.id] ?? null} formTag={formTags?.[piece.id] ?? null} glazeTag={glazeTags?.[piece.id] ?? null} selectMode={selectMode} selected={selectedIds?.has(piece.id) ?? false} onToggleSelect={toggleSelect} />
              ))}
            </div>
          </div>
        ))}
        {!loading && !error && !dayKey && pieces.length > 0 && viewMode === 'stage' && allStages.map((stage) => (
          <StageColumn
            key={stage}
            stage={stage}
            pieces={piecesByStage[stage]}
            thumbUrls={thumbUrls}
            formTags={formTags}
            glazeTags={glazeTags}
            stageDates={stageDates}
            selectMode={selectMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            collapsed={!!collapsedStages[stage]}
            onToggleCollapsed={handleToggleStageCollapsed}
            density={density}
          />
        ))}
        {!loading && !error && !dayKey && pieces.length > 0 && viewMode === 'clay_body' && clayBodyGroups.map(({ key, label, pieces: groupPieces }) => (
          <div key={key} className="mb-8">
            <GroupHeader label={label} count={groupPieces.length} collapsed={!!collapsedGroups[key]} onToggle={() => toggleGroup(key)} />
            {!collapsedGroups[key] && (
              <div className={`grid ${gridCols} lg:grid-cols-5 gap-3 sm:gap-4`}>
                {groupPieces.map((piece) => (
                  <PieceCard key={piece.id} piece={piece} thumbUrl={thumbUrls?.[piece.id] ?? null} formTag={formTags?.[piece.id] ?? null} glazeTag={glazeTags?.[piece.id] ?? null} selectMode={selectMode} selected={selectedIds?.has(piece.id) ?? false} onToggleSelect={toggleSelect} />
                ))}
              </div>
            )}
          </div>
        ))}
        {!loading && !error && !dayKey && pieces.length > 0 && viewMode === 'glaze' && glazeGroups.map(({ key, label, pieces: groupPieces }) => (
          <div key={key} className="mb-8">
            <GroupHeader label={label} count={groupPieces.length} collapsed={!!collapsedGroups[key]} onToggle={() => toggleGroup(key)} />
            {!collapsedGroups[key] && (
              <div className={`grid ${gridCols} lg:grid-cols-5 gap-3 sm:gap-4`}>
                {groupPieces.map((piece) => (
                  <PieceCard key={piece.id} piece={piece} thumbUrl={thumbUrls?.[piece.id] ?? null} formTag={formTags?.[piece.id] ?? null} glazeTag={glazeTags?.[piece.id] ?? null} selectMode={selectMode} selected={selectedIds?.has(piece.id) ?? false} onToggleSelect={toggleSelect} />
                ))}
              </div>
            )}
          </div>
        ))}
        {!loading && !error && !dayKey && pieces.length > 0 && viewMode === 'form' && formGroups.map(({ key, label, pieces: groupPieces }) => (
          <div key={key} className="mb-8">
            <GroupHeader label={label} count={groupPieces.length} collapsed={!!collapsedGroups[key]} onToggle={() => toggleGroup(key)} />
            {!collapsedGroups[key] && (
              <div className={`grid ${gridCols} lg:grid-cols-5 gap-3 sm:gap-4`}>
                {groupPieces.map((piece) => (
                  <PieceCard key={piece.id} piece={piece} thumbUrl={thumbUrls?.[piece.id] ?? null} formTag={formTags?.[piece.id] ?? null} glazeTag={glazeTags?.[piece.id] ?? null} selectMode={selectMode} selected={selectedIds?.has(piece.id) ?? false} onToggleSelect={toggleSelect} />
                ))}
              </div>
            )}
          </div>
        ))}
      </main>

      {/* FAB */}
      {!selectMode && pieces.length > 0 && (
        <button
          onClick={() => setShowAddPiece(true)}
          className="fixed bottom-18 right-5 w-14 h-14 compact:w-12 compact:h-12 bg-clay text-white text-3xl rounded-full shadow-lg flex items-center justify-center active:bg-clay-dark cursor-pointer hover:bg-clay-dark"
          aria-label="Add piece"
        >
          +
        </button>
      )}

      {/* Bulk action bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-0 inset-x-0 pb-safe bg-surface-raised border-t border-line px-4 pt-3">
          <div className="flex items-center gap-3 pb-3">
            <span className="text-sm text-muted flex-1">
              {selectedIds.size} {selectedIds.size === 1 ? 'piece' : 'pieces'} selected
            </span>
            <button
              onClick={() => setShowTagSheet(true)}
              disabled={bulkSaving}
              className="px-4 py-2 rounded-xl border border-line-strong text-sm text-ink font-medium active:bg-surface-warm-hover disabled:opacity-50 cursor-pointer hover:bg-surface-warm-hover"
            >
              Edit Tags
            </button>
            <button
              onClick={() => setShowGiftConfirm(true)}
              disabled={bulkSaving}
              className="px-4 py-2 rounded-xl border border-line-strong text-sm text-ink font-medium active:bg-surface-warm-hover disabled:opacity-50 cursor-pointer hover:bg-surface-warm-hover"
            >
              Gift
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
        <div className="flex flex-col gap-5 pb-4">
          <div>
            <p className="text-sm text-ink font-medium">{user.user_metadata?.full_name || user.email}</p>
            <p className="text-xs text-muted">{user.email}</p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-widest text-muted mb-2">Studio name</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={editStudioName}
                onChange={e => setEditStudioName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.target.blur(); handleSaveStudioName() } }}
                placeholder="e.g. Muddy Hands Studio"
                className="flex-1 border border-line rounded-xl px-3 py-2 text-sm bg-surface-warm text-ink placeholder:text-muted"
              />
              <button
                onClick={handleSaveStudioName}
                disabled={savingStudioName || editStudioName === studioName}
                className="px-3 py-2 rounded-xl bg-clay text-white text-sm disabled:opacity-40 cursor-pointer hover:bg-clay-dark disabled:cursor-default"
              >
                {savingStudioName ? '…' : 'Save'}
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-widest text-muted mb-2">Theme</p>
            <SegmentedControl
              ariaLabel="Theme"
              value={theme}
              onChange={handleThemeChange}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'system', label: 'System' },
              ]}
            />
          </div>

          <div>
            <p className="text-xs uppercase tracking-widest text-muted mb-2">Density</p>
            <SegmentedControl
              ariaLabel="Density"
              value={density}
              onChange={handleDensityChange}
              options={[
                { value: 'comfortable', label: 'Comfortable' },
                { value: 'compact', label: 'Compact' },
              ]}
            />
          </div>

          <button
            onClick={() => { setShowProfile(false); navigate('/portfolio') }}
            className="text-left text-sm text-muted cursor-pointer hover:text-ink-soft"
          >
            Public portfolio
          </button>

          {isDevOwner(user.email) && (
            <button
              onClick={() => { setShowProfile(false); navigate('/dev') }}
              className="text-left text-sm text-muted cursor-pointer hover:text-ink-soft"
            >
              Developer diagnostics
            </button>
          )}

          <button
            onClick={handleLogout}
            className="mt-2 text-left text-sm text-red-500 cursor-pointer hover:text-red-700"
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
            <p className="text-xs uppercase tracking-widest text-muted mb-2">Form</p>
            <div className="flex flex-wrap gap-2">
              {PRESET_TAGS.form.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleBulkToggleTag(tag, 'form')}
                  className="px-4 py-1.5 rounded-full text-sm border border-line-strong text-ink-soft bg-surface-raised active:bg-surface-warm-hover cursor-pointer hover:bg-surface-warm-hover"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
          {userTags.filter(t => t.category === 'glaze').length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-widest text-muted mb-2">Glaze</p>
              <div className="flex flex-wrap gap-2">
                {userTags.filter(t => t.category === 'glaze').map((tag) => (
                  <button
                    key={tag.name}
                    onClick={() => handleBulkToggleTag(tag.name, 'glaze')}
                    className="px-4 py-1.5 rounded-full text-sm border border-line-strong text-ink-soft bg-surface-raised active:bg-surface-warm-hover cursor-pointer hover:bg-surface-warm-hover"
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

      {/* Gift confirmation sheet */}
      <BottomSheet
        open={showGiftConfirm}
        onClose={() => setShowGiftConfirm(false)}
        title={`Mark ${selectedIds.size} ${selectedIds.size === 1 ? 'piece' : 'pieces'} as gifted?`}
      >
        <div className="flex flex-col gap-3 pb-2">
          <p className="text-sm text-muted">
            {selectedIds.size === 1 ? 'It' : 'They'} will stay on the board and be marked with a gift badge.
          </p>
          <button
            onClick={handleBulkGift}
            disabled={bulkSaving}
            className="w-full bg-clay text-white font-semibold py-3.5 rounded-2xl active:bg-clay-dark disabled:opacity-50 cursor-pointer hover:bg-clay-dark"
          >
            {bulkSaving ? 'Moving…' : 'Yes, mark as gifted'}
          </button>
          <button
            onClick={() => setShowGiftConfirm(false)}
            className="w-full bg-surface-warm text-ink-soft font-semibold py-3.5 rounded-2xl active:bg-surface-warm-hover cursor-pointer hover:bg-surface-warm-hover"
          >
            Cancel
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
          <p className="text-sm text-muted">
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
            className="w-full bg-surface-warm text-ink-soft font-semibold py-3.5 rounded-2xl active:bg-surface-warm-hover cursor-pointer hover:bg-surface-warm-hover"
          >
            Cancel
          </button>
        </div>
      </BottomSheet>

      {!selectMode && (
        <footer className="fixed bottom-0 inset-x-0 pb-safe bg-surface/80 backdrop-blur-sm border-t border-line/50 flex items-center justify-center pt-2">
          <button onClick={() => navigate('/graveyard')} className="text-xs uppercase tracking-widest text-muted hover:text-clay cursor-pointer transition-colors py-1">
            Reclaim
          </button>
        </footer>
      )}
    </div>
  )
}
