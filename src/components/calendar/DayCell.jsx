import React from 'react'
import { STAGE_COLORS } from '../../lib/pieces.js'

// Build the dynamic gradient + glow for a day with activity.
// Stages present are ordered by count desc, so the most-dominant stage leads
// the gradient. Glow blur/spread scale with the day's volume vs. the busiest day.
function cellStyle(dayData, maxTotal) {
  const ordered = Object.entries(dayData.stageCounts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([stage]) => STAGE_COLORS[stage])

  if (ordered.length === 0) return null

  const background =
    ordered.length === 1
      ? ordered[0]
      : `linear-gradient(135deg, ${ordered.join(', ')})`

  const intensity = Math.min(1, dayData.total / Math.max(1, maxTotal))
  const blur = 4 + Math.round(intensity * 14) // 4–18px
  const spread = Math.round(intensity * 4) // 0–4px

  return {
    background,
    boxShadow: `0 0 ${blur}px ${spread}px ${ordered[0]}`,
  }
}

function DayCell({ date, inMonth, dayData, maxTotal, isToday, onSelect }) {
  if (!inMonth || !date) {
    return <div className="aspect-square" />
  }

  const hasActivity = dayData && dayData.total > 0
  const style = hasActivity ? cellStyle(dayData, maxTotal) : null
  const dayNum = date.getDate()

  const base =
    'aspect-square rounded-xl flex items-center justify-center text-xs font-semibold transition-opacity select-none'

  if (!hasActivity) {
    return (
      <div
        className={`${base} bg-surface-warm text-muted ${
          isToday ? 'ring-2 ring-clay' : ''
        }`}
      >
        {dayNum}
      </div>
    )
  }

  return (
    <button
      onClick={() => onSelect(date)}
      style={style}
      aria-label={`${dayData.total} ${dayData.total === 1 ? 'event' : 'events'} on ${date.toDateString()}`}
      className={`${base} text-white cursor-pointer hover:opacity-80 active:opacity-70 ${
        isToday ? 'ring-2 ring-clay' : ''
      }`}
    >
      <span className="drop-shadow">{dayNum}</span>
    </button>
  )
}

export default React.memo(DayCell)
