// Pure derivation helpers for the calendar activity heatmap.
// No Supabase calls here — these operate on already-fetched pieces + stage_events.

const STAGE_KEYS = ['drying', 'bisque_ready', 'glazed', 'finished']

// Local-time YYYY-MM-DD key for a Date or ISO string.
export function dayKey(date) {
  const d = date instanceof Date ? date : new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function emptyStageCounts() {
  return { drying: 0, bisque_ready: 0, glazed: 0, finished: 0 }
}

// Mirror of PieceDetail's pickTimestamp: prefer moved_at, then fall back.
function eventTimestamp(ev) {
  return ev.moved_at || ev.created_at || ev.inserted_at || null
}

/**
 * Build per-day activity from pieces + stage events.
 * - Each piece counts as one `drying` throw on its created_at day.
 * - Each stage_event counts toward its stage on its moved_at day.
 * Returns Map<dayKey, { total, stageCounts, pieceIds: Set }>.
 */
export function buildActivityByDay(pieces = [], stageEvents = []) {
  const byDay = new Map()

  const ensure = (key) => {
    let entry = byDay.get(key)
    if (!entry) {
      entry = { total: 0, stageCounts: emptyStageCounts(), pieceIds: new Set() }
      byDay.set(key, entry)
    }
    return entry
  }

  for (const piece of pieces) {
    if (!piece.created_at) continue
    const entry = ensure(dayKey(piece.created_at))
    entry.stageCounts.drying += 1
    entry.total += 1
    entry.pieceIds.add(piece.id)
  }

  for (const ev of stageEvents) {
    const ts = eventTimestamp(ev)
    if (!ts || !STAGE_KEYS.includes(ev.stage)) continue
    const entry = ensure(dayKey(ts))
    entry.stageCounts[ev.stage] += 1
    entry.total += 1
    if (ev.piece_id) entry.pieceIds.add(ev.piece_id)
  }

  return byDay
}

/**
 * Weeks of day cells for a Sun–Sat month grid, with leading/trailing blanks.
 * Returns week[][] of { date: Date|null, inMonth: boolean }.
 */
export function monthMatrix(year, monthIndex) {
  const first = new Date(year, monthIndex, 1)
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const leading = first.getDay() // 0 = Sunday

  const cells = []
  for (let i = 0; i < leading; i++) cells.push({ date: null, inMonth: false })
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, monthIndex, d), inMonth: true })
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, inMonth: false })

  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

// Total activity per month for a given year — drives the year strip glow.
export function monthTotals(activityByDay, year) {
  const totals = new Array(12).fill(0)
  for (const [key, entry] of activityByDay) {
    const [y, m] = key.split('-')
    if (Number(y) === year) totals[Number(m) - 1] += entry.total
  }
  return totals
}
