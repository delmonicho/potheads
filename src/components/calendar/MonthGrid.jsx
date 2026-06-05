import React from 'react'
import DayCell from './DayCell.jsx'
import { monthMatrix, dayKey } from '../../lib/calendar.js'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function MonthGrid({ year, monthIndex, activityByDay, maxTotal, onSelectDay }) {
  const weeks = monthMatrix(year, monthIndex)
  const todayKey = dayKey(new Date())

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="text-center text-[10px] uppercase tracking-widest text-muted">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {weeks.flat().map((cell, i) => {
          const key = cell.date ? dayKey(cell.date) : null
          return (
            <DayCell
              key={i}
              date={cell.date}
              inMonth={cell.inMonth}
              dayData={key ? activityByDay.get(key) : null}
              maxTotal={maxTotal}
              isToday={key === todayKey}
              onSelect={onSelectDay}
            />
          )
        })}
      </div>
    </div>
  )
}

export default React.memo(MonthGrid)
