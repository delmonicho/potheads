import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPieces, getStageEventsForUser, STAGE_LABELS, STAGE_COLORS } from '../lib/pieces.js'
import { buildActivityByDay, dayKey } from '../lib/calendar.js'
import PageHeader from '../components/PageHeader.jsx'
import MonthGrid from '../components/calendar/MonthGrid.jsx'
import YearStrip from '../components/calendar/YearStrip.jsx'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function MonthArrow({ dir, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label={dir === 'prev' ? 'Previous month' : 'Next month'}
      className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:bg-clay-tint hover:text-ink-soft cursor-pointer active:text-ink-soft"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        {dir === 'prev' ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
      </svg>
    </button>
  )
}

export default function Calendar({ user }) {
  const navigate = useNavigate()
  const [pieces, setPieces] = useState([])
  const [stageEvents, setStageEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const fetchAll = useCallback(async () => {
    try {
      const [pieceData, eventData] = await Promise.all([
        getPieces(user.id),
        getStageEventsForUser(),
      ])
      setPieces(pieceData)
      setStageEvents(eventData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user.id])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const activityByDay = useMemo(
    () => buildActivityByDay(pieces, stageEvents),
    [pieces, stageEvents],
  )

  const maxTotal = useMemo(() => {
    let max = 0
    for (const entry of activityByDay.values()) if (entry.total > max) max = entry.total
    return max
  }, [activityByDay])

  function changeMonth(delta) {
    let m = viewMonth + delta
    let y = viewYear
    if (m < 0) { m = 11; y -= 1 }
    if (m > 11) { m = 0; y += 1 }
    setViewMonth(m)
    setViewYear(y)
  }

  function handleSelectDay(date) {
    const key = dayKey(date)
    const entry = activityByDay.get(key)
    if (!entry || entry.pieceIds.size === 0) return
    const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    // Serialize pieceActions (Map<id, Set>) to plain JSON for router state so the
    // Board can group the day by action. pieceIds is derivable from its keys.
    const actions = Object.fromEntries(
      [...entry.pieceActions].map(([id, set]) => [id, [...set]]),
    )
    navigate('/board', {
      state: { dayFilter: { key, label, actions } },
    })
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      <PageHeader title="Calendar" onBack={() => navigate('/board')} />

      <main className="flex-1 overflow-y-auto px-4 py-4 pb-24">
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-clay border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {error && <p className="text-red-600 text-sm text-center py-4">{error}</p>}

        {!loading && !error && (
          <>
            <YearStrip
              year={viewYear}
              activeMonth={viewMonth}
              activityByDay={activityByDay}
              onSelectMonth={setViewMonth}
              onChangeYear={setViewYear}
            />

            <div className="flex items-center justify-between mt-4 mb-3">
              <MonthArrow dir="prev" onClick={() => changeMonth(-1)} />
              <h2 className="font-display italic text-2xl text-ink">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </h2>
              <MonthArrow dir="next" onClick={() => changeMonth(1)} />
            </div>

            <MonthGrid
              year={viewYear}
              monthIndex={viewMonth}
              activityByDay={activityByDay}
              maxTotal={maxTotal}
              onSelectDay={handleSelectDay}
            />

            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-6 pt-4 border-t border-line/70">
              {Object.entries(STAGE_LABELS).map(([stage, label]) => (
                <div key={stage} className="flex items-center gap-1.5">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ background: STAGE_COLORS[stage] }}
                  />
                  <span className="text-xs text-muted">{label}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted mt-3">
              Brighter glow means more activity. Tap a day to see those pieces.
            </p>
          </>
        )}
      </main>
    </div>
  )
}
