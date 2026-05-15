export default function SegmentedControl({ value, options, onChange, ariaLabel }) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex w-full bg-stone-100 dark:bg-surface-warm rounded-full p-1"
    >
      {options.map((opt) => {
        const selected = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={`flex-1 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest rounded-full cursor-pointer transition-colors ${
              selected
                ? 'bg-surface-raised text-ink shadow-sm'
                : 'text-muted hover:text-ink-soft'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
