import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { getPublicPortfolio } from '../lib/portfolio.js'
import MuseumLabel from '../components/portfolio/MuseumLabel.jsx'

// Public, no-auth portfolio page (/p/:slug). Renders only what RLS returns: a
// published portfolio, its showcased items, and their photos. Editorial
// single-column layout (masonry + process strip land in Phase 2).
export default function PublicPortfolio() {
  const { slug } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState(null)
  const [lightbox, setLightbox] = useState(null) // { photos, index }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    setError(null)
    getPublicPortfolio(slug)
      .then((result) => {
        if (cancelled) return
        if (!result) setNotFound(true)
        else setData(result)
      })
      .catch((err) => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [slug])

  // Set a tab title for humans (crawler OG tags arrive via SSR in Phase 3).
  useEffect(() => {
    if (data?.portfolio?.title) document.title = `${data.portfolio.title} · Potheads`
    return () => { document.title = 'Potheads' }
  }, [data])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <div className="w-8 h-8 border-4 border-clay border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-surface px-8 text-center">
        <h1 className="font-display italic text-3xl text-ink">Nothing here.</h1>
        <p className="text-sm text-muted mt-2 max-w-xs">
          This portfolio doesn’t exist or hasn’t been published yet.
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-surface px-8 text-center">
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    )
  }

  const { portfolio, items } = data

  return (
    <div className="min-h-screen bg-surface">
      <div className="mx-auto max-w-2xl px-5 pt-safe pb-24">
        {/* Header */}
        <header className="pt-12 pb-10 text-center">
          <h1 className="font-display italic text-4xl text-ink">{portfolio.title || 'Portfolio'}</h1>
          {portfolio.studio_identity && (
            <p className="text-xs uppercase tracking-widest text-muted mt-3">{portfolio.studio_identity}</p>
          )}
          {portfolio.statement && (
            <p className="text-[15px] text-ink-soft leading-relaxed max-w-prose mx-auto mt-5">
              {portfolio.statement}
            </p>
          )}
        </header>

        {items.length === 0 ? (
          <p className="text-center text-sm text-muted py-12">No pieces yet.</p>
        ) : (
          <div className="flex flex-col gap-16">
            {items.map((item) => (
              <PortfolioPiece key={item.id} item={item} onOpen={(index) => setLightbox({ photos: item.photos, index })} />
            ))}
          </div>
        )}

        <footer className="pt-16 text-center">
          <p className="text-[11px] uppercase tracking-widest text-muted/70">Made with Potheads</p>
        </footer>
      </div>

      {lightbox && (
        <Lightbox
          photos={lightbox.photos}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  )
}

function PortfolioPiece({ item, onOpen }) {
  const photos = item.photos || []
  const hero = photos[0]

  return (
    <article className="flex flex-col gap-4">
      {hero?.url ? (
        <button
          onClick={() => onOpen(0)}
          className="block w-full overflow-hidden rounded-2xl bg-tan cursor-pointer hover:opacity-95 transition-opacity"
          aria-label={`View ${item.title || 'piece'}`}
        >
          <img
            src={hero.url}
            alt={item.title || ''}
            loading="lazy"
            className="w-full max-h-[70vh] object-contain bg-tan"
          />
        </button>
      ) : (
        <div className="w-full aspect-square rounded-2xl bg-tan" />
      )}

      {/* Thumbnail strip for additional photos */}
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {photos.map((p, i) => (
            <button
              key={p.id}
              onClick={() => onOpen(i)}
              className="shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-tan cursor-pointer hover:opacity-80 transition-opacity"
              aria-label={`View photo ${i + 1}`}
            >
              {p.url && <img src={p.url} alt="" loading="lazy" className="w-full h-full object-cover" />}
            </button>
          ))}
        </div>
      )}

      <MuseumLabel item={item} />
    </article>
  )
}

function Lightbox({ photos, index, onClose }) {
  const [i, setI] = useState(index)
  const photo = photos[i]
  const prev = useCallback(() => setI((n) => (n > 0 ? n - 1 : photos.length - 1)), [photos.length])
  const next = useCallback(() => setI((n) => (n < photos.length - 1 ? n + 1 : 0)), [photos.length])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, prev, next])

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" onClick={onClose}>
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white text-2xl leading-none flex items-center justify-center cursor-pointer hover:bg-white/20"
        aria-label="Close"
      >
        ×
      </button>

      {photo?.url && (
        <img
          src={photo.url}
          alt=""
          className="max-w-[92vw] max-h-[85vh] object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {photos.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prev() }}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center cursor-pointer hover:bg-white/20"
            aria-label="Previous"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next() }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center cursor-pointer hover:bg-white/20"
            aria-label="Next"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
          <span className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/70 text-sm tabular-nums">
            {i + 1} / {photos.length}
          </span>
        </>
      )}
    </div>
  )
}
