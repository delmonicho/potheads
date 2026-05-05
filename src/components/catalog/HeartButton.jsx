import { memo } from 'react'

function HeartButton({ favorite, onToggle, size = 22, className = '' }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(!favorite) }}
      className={`flex items-center justify-center cursor-pointer hover:scale-110 active:scale-95 transition-transform ${className}`}
      aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
      aria-pressed={favorite}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={favorite ? '#78350f' : 'none'}
        stroke={favorite ? '#78350f' : '#7c5545'}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  )
}

export default memo(HeartButton)
