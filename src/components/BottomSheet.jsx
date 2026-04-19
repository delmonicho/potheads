export default function BottomSheet({ open, onClose, title, children }) {
  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col justify-end transition-all duration-300 ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`relative bg-white rounded-t-2xl shadow-xl transition-transform duration-300 ${open ? 'translate-y-0' : 'translate-y-full'}`}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-stone-300 rounded-full" />
        </div>

        {title && (
          <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#1c1917]">{title}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 text-xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        )}

        <div className="px-4 py-4 pb-safe overflow-y-auto max-h-[85vh]">
          {children}
        </div>
      </div>
    </div>
  )
}
