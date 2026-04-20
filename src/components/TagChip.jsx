export default function TagChip({ tag, selected, onToggle, onRemove }) {
  const colors = {
    form: selected
      ? 'bg-[#78350f] text-white border-[#78350f]'
      : 'border-[#78350f]/40 text-[#78350f]',
    glaze: selected
      ? 'bg-[#4a7c59] text-white border-[#4a7c59]'
      : 'border-[#4a7c59]/40 text-[#4a7c59]',
  }
  const colorClass = colors[tag.category] ?? (selected
    ? 'bg-stone-900 text-white border-stone-900'
    : 'border-stone-300 text-stone-700')

  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-sm font-medium ${colorClass} ${onToggle ? 'cursor-pointer' : ''}`}
      onClick={onToggle ? () => onToggle(tag) : undefined}
    >
      {tag.name}
      {onRemove && (
        <button
          className="ml-1 opacity-70 hover:opacity-100"
          onClick={(e) => { e.stopPropagation(); onRemove(tag) }}
          aria-label={`Remove ${tag.name}`}
        >
          ×
        </button>
      )}
    </span>
  )
}
