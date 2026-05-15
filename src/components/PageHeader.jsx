function BackChevron() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  )
}

export default function PageHeader({
  title,
  titleSize = 'text-3xl',
  onBack,
  trailing,
  children,
  sticky = true,
}) {
  const wrapperClass = `px-5 pt-safe bg-surface border-b border-line/70 ${sticky ? 'sticky top-0 z-10' : ''}`
  return (
    <header className={wrapperClass}>
      <div className="flex items-center justify-between py-4 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              aria-label="Back"
              className="-ml-1.5 w-9 h-9 rounded-full flex items-center justify-center text-muted hover:bg-clay-tint hover:text-ink-soft cursor-pointer active:text-ink-soft"
            >
              <BackChevron />
            </button>
          )}
          {title && (
            <h1 className={`font-display italic ${titleSize} text-ink truncate`}>{title}</h1>
          )}
        </div>
        {trailing && <div className="flex items-center gap-3 shrink-0">{trailing}</div>}
      </div>
      {children}
    </header>
  )
}
