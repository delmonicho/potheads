// Two-column masonry gallery: images keep their natural aspect ratio (varied
// heights stagger the columns) with a compact caption. Tapping opens the
// lightbox. Full museum details live in the editorial layout / lightbox.
const STATUS_LABELS = { available: 'Available', sold: 'Sold', nfs: 'NFS' }

export default function MasonryLayout({ items, onOpen }) {
  return (
    <div className="columns-2 gap-4 [column-fill:_balance]">
      {items.map((item) => {
        const hero = (item.photos || [])[0]
        return (
          <div key={item.id} className="mb-4 break-inside-avoid">
            <button
              onClick={() => onOpen(item, 0)}
              className="block w-full overflow-hidden rounded-xl bg-tan cursor-pointer hover:opacity-95 transition-opacity"
              aria-label={`View ${item.title || 'piece'}`}
            >
              {hero?.url ? (
                <img src={hero.url} alt={item.title || ''} loading="lazy" className="w-full h-auto object-cover" />
              ) : (
                <span className="block w-full aspect-square bg-tan" />
              )}
            </button>
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <p className="font-display italic text-base text-ink leading-tight truncate">{item.title || 'Untitled'}</p>
              {item.status && (
                <span className="text-[10px] uppercase tracking-widest text-muted shrink-0">
                  {STATUS_LABELS[item.status] || item.status}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
