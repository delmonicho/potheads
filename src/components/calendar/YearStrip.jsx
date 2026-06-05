import React from 'react'
import { monthTotals } from '../../lib/calendar.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function ArrowButton({ dir, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label={dir === 'prev' ? 'Previous year' : 'Next year'}
      className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-muted hover:bg-clay-tint hover:text-ink-soft cursor-pointer"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {dir === 'prev' ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
      </svg>
    </button>
  )
}

function YearStrip({ year, activeMonth, activityByDay, onSelectMonth, onChangeYear }) {
  const totals = monthTotals(activityByDay, year)
  const max = Math.max(1, ...totals)

  return (
    <div className="flex items-center gap-1">
      <ArrowButton dir="prev" onClick={() => onChangeYear(year - 1)} />
      <div className="flex-1 flex gap-1 overflow-x-auto py-1">
        {MONTHS.map((label, i) => {
          const isActive = i === activeMonth
          const intensity = totals[i] / max
          return (
            <button
              key={i}
              onClick={() => onSelectMonth(i)}
              style={totals[i] > 0 ? { boxShadow: `0 0 ${4 + Math.round(intensity * 8)}px 0 var(--color-clay)` } : undefined}
              className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                isActive
                  ? 'bg-clay text-white'
                  : 'bg-surface-warm text-ink-soft hover:bg-surface-warm-hover'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>
      <ArrowButton dir="next" onClick={() => onChangeYear(year + 1)} />
    </div>
  )
}

export default React.memo(YearStrip)
