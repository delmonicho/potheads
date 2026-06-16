import { memo } from 'react'
import { CATEGORY_DEFAULTS, readableTextColor, contrastColor } from '../lib/useTagColors.js'

export default memo(function TagChip({ tag, selected, onToggle, onRemove, color }) {
  const chipColor = color || CATEGORY_DEFAULTS[tag.category] || '#78350f'

  // Filled chips: pick black/white ink by the fill's luminance so pale glaze
  // colors don't end up as light text on a light pill. Outlined chips: nudge the
  // color so it stays legible against the current (light or dark) surface.
  const style = selected
    ? { backgroundColor: chipColor, borderColor: chipColor, color: readableTextColor(chipColor) }
    : { borderColor: `${contrastColor(chipColor)}80`, color: contrastColor(chipColor) }

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
