import MuseumLabel from './MuseumLabel.jsx'
import ProcessStrip from './ProcessStrip.jsx'

// Single-column "editorial" gallery: large hero image, optional thumbnail strip,
// full museum label, and (if enabled) the making-of process reveal.
export default function EditorialLayout({ items, onOpen }) {
  return (
    <div className="flex flex-col gap-16">
      {items.map((item) => {
        const photos = item.photos || []
        const hero = photos[0]
        return (
          <article key={item.id} className="flex flex-col gap-4">
            {hero?.url ? (
              <button
                onClick={() => onOpen(item, 0)}
                className="block w-full overflow-hidden rounded-2xl bg-tan cursor-pointer hover:opacity-95 transition-opacity"
                aria-label={`View ${item.title || 'piece'}`}
              >
                <img src={hero.url} alt={item.title || ''} loading="lazy" className="w-full max-h-[70vh] object-contain bg-tan" />
              </button>
            ) : (
              <div className="w-full aspect-square rounded-2xl bg-tan" />
            )}

            {photos.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {photos.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => onOpen(item, i)}
                    className="shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-tan cursor-pointer hover:opacity-80 transition-opacity"
                    aria-label={`View photo ${i + 1}`}
                  >
                    {p.url && <img src={p.url} alt="" loading="lazy" className="w-full h-full object-cover" />}
                  </button>
                ))}
              </div>
            )}

            <MuseumLabel item={item} />
            {item.show_process && <ProcessStrip photos={photos} onOpenPhoto={(i) => onOpen(item, i)} />}
          </article>
        )
      })}
    </div>
  )
}
