import { memo } from 'react'
import { CATEGORY_DEFAULTS } from '../lib/useTagColors.js'

export default memo(function TagChip({ tag, selected, onToggle, onRemove, color }) {
  const chipColor = color || CATEGORY_DEFAULTS[tag.category] || '#78350f'

  const style = selected
    ? { backgroundColor: chipColor, borderColor: chipColor, color: 'white' }
    : { borderColor: `${chipColor}66`, color: chipColor }

  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-sm font-medium transition-opacity ${onToggle ? 'cursor-pointer hover:opacity-80' : ''}`}
      style={style}
      onClick={onToggle ? () => onToggle(tag) : undefined}
    >
      {tag.name}
      {onRemove && (
        <button
          className="ml-1 opacity-70 hover:opacity-100 cursor-pointer"
          onClick={(e) => { e.stopPropagation(); onRemove(tag) }}
          aria-label={`Remove ${tag.name}`}
        >
          ×
        </button>
      )}
    </span>
  )
})
