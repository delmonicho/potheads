import { useState } from 'react'

export default function SwatchInfo({ className = '' }) {
  const [open, setOpen] = useState(false)
  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="text-muted hover:text-clay-dark cursor-pointer"
        aria-label="About this color swatch"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
      </button>
      {open && (
        <span className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-1 w-56 px-3 py-2 rounded-lg bg-stone-900 text-white text-xs leading-snug shadow-lg pointer-events-none">
          Approximate fired color. Actual results vary with glaze, atmosphere, kiln load, and thickness.
        </span>
      )}
    </span>
  )
}
