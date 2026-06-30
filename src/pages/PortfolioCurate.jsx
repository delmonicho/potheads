import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPieces, STAGES } from '../lib/pieces.js'
import { getPhotosForPieces, getPhotoUrls } from '../lib/photos.js'
import { getTagsForPieces } from '../lib/tags.js'
import {
  getMyPortfolio, createPortfolio, updatePortfolio,
  getPortfolioItems, showcasePiece, setItemShowcased,
  buildItemSnapshot, slugify, validateSlug,
} from '../lib/portfolio.js'
import PotteryPlaceholder from '../components/PotteryPlaceholder.jsx'

export default function PortfolioCurate({ user }) {
  const navigate = useNavigate()
  const [portfolio, setPortfolio] = useState(null)
  const [pieces, setPieces] = useState([])
  const [thumbUrls, setThumbUrls] = useState({})
  const [formTags, setFormTags] = useState({})
  const [tagsByPiece, setTagsByPiece] = useState(new Map())
  const [items, setItems] = useState(new Map()) // pieceId → item row
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      const pf = await getMyPortfolio(user.id)
      setPortfolio(pf)
      if (!pf) { setLoading(false); return }

      const [data, itemRows] = await Promise.all([
        getPieces(user.id),
        getPortfolioItems(pf.id),
      ])
      const active = data.filter((p) => !p.lost)
      setPieces(active)
      setItems(new Map(itemRows.map((it) => [it.piece_id, it])))

      if (active.length === 0) { setLoading(false); return }
      const pieceIds = active.map((p) => p.id)
      const [photosByPiece, tagsMap] = await Promise.all([
        getPhotosForPieces(pieceIds),
        getTagsForPieces(pieceIds),
      ])
      setTagsByPiece(tagsMap)

      const newFormTags = {}
      for (const [pieceId, tags] of tagsMap) {
        const ft = tags.find((t) => t.category === 'form' && t.name !== 'lost')
        if (ft) newFormTags[pieceId] = ft.name
      }
      setFormTags(newFormTags)

      // Latest-stage photo per piece as the thumbnail (matches Board).
      const thumbEntries = []
      for (const piece of active) {
        const photos = photosByPiece.get(piece.id) || []
        if (photos.length) {
          const latestStage = [...STAGES].reverse().find((s) => photos.some((p) => p.stage === s))
          const thumb = latestStage ? photos.find((p) => p.stage === latestStage) : photos[0]
          if (thumb) thumbEntries.push({ pieceId: piece.id, path: thumb.storage_path })
        }
      }
      const urls = await getPhotoUrls(thumbEntries.map((e) => e.path)).catch(() => [])
      const newThumbs = {}
      thumbEntries.forEach(({ pieceId }, i) => { newThumbs[pieceId] = urls[i] })
      setThumbUrls(newThumbs)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user.id])

  useEffect(() => { load() }, [load])

  const showcasedCount = useMemo(
    () => [...items.values()].filter((it) => it.showcased).length,
    [items],
  )

  async function handleToggle(piece) {
    const existing = items.get(piece.id)
    const isOn = existing?.showcased
    // optimistic
    const optimistic = new Map(items)
    try {
      if (isOn) {
        optimistic.set(piece.id, { ...existing, showcased: false })
        setItems(optimistic)
        await setItemShowcased(portfolio.id, piece.id, false)
      } else {
        const snapshot = buildItemSnapshot(piece, tagsByPiece.get(piece.id) || [])
        const position = existing?.position ?? showcasedCount
        const row = await showcasePiece(portfolio.id, piece, snapshot, position)
        optimistic.set(piece.id, row)
        setItems(optimistic)
      }
    } catch (err) {
      setError(err.message)
      load() // resync on failure
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <div className="w-8 h-8 border-4 border-clay border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!portfolio) {
    return <CreatePortfolio user={user} onCreated={(pf) => { setPortfolio(pf); setLoading(true); load() }} onBack={() => navigate('/board')} />
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      <header className="px-5 pt-safe bg-surface sticky top-0 z-10 border-b border-line/70">
        <div className="flex items-center justify-between pt-3 pb-2">
          <button
            onClick={() => navigate('/board')}
            className="flex items-center gap-1 text-xs uppercase tracking-widest text-clay font-semibold cursor-pointer hover:text-clay-dark"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            Board
          </button>
          <span className="text-xs uppercase tracking-widest text-muted">
            {showcasedCount} showcased
          </span>
        </div>
        <h1 className="font-display italic text-4xl text-ink pb-3">Portfolio.</h1>
      </header>

      <main className="flex-1 overflow-y-auto px-5 py-5 pb-24 flex flex-col gap-6">
        {error && <p className="text-red-600 text-sm text-center">{error}</p>}

        <PortfolioSettings
          portfolio={portfolio}
          onChange={setPortfolio}
          onError={setError}
        />

        <div>
          <p className="text-xs uppercase tracking-widest text-muted mb-3">
            Tap pieces to showcase
          </p>
          {pieces.length === 0 ? (
            <p className="text-sm text-muted">No pieces yet. Throw something first.</p>
          ) : (
            <div className="grid grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              {pieces.map((piece) => (
                <CurateCard
                  key={piece.id}
                  piece={piece}
                  thumbUrl={thumbUrls[piece.id] ?? null}
                  formTag={formTags[piece.id] ?? null}
                  showcased={items.get(piece.id)?.showcased ?? false}
                  onToggle={() => handleToggle(piece)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function CurateCard({ piece, thumbUrl, formTag, showcased, onToggle }) {
  const [imgLoaded, setImgLoaded] = useState(false)
  return (
    <div
      onClick={onToggle}
      className="flex flex-col rounded-2xl overflow-hidden bg-surface-raised border border-line shadow-sm hover:shadow-md transition-shadow active:opacity-90 cursor-pointer relative"
    >
      <div className="aspect-square bg-tan overflow-hidden">
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt=""
            className={`w-full h-full object-cover transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImgLoaded(true)}
          />
        ) : (
          <PotteryPlaceholder formTag={formTag} />
        )}
      </div>
      <div className={`absolute inset-0 rounded-2xl transition-colors ${showcased ? 'bg-clay/20' : ''}`}>
        <div className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
          showcased ? 'bg-clay border-clay' : 'bg-white/70 border-white'
        }`}>
          {showcased && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="2 6 5 9 10 3" />
            </svg>
          )}
        </div>
      </div>
      <div className="px-3 py-2.5 bg-surface-raised">
        <p className="text-sm font-semibold text-ink truncate leading-snug">{piece.name}</p>
        {formTag && <p className="text-[10px] uppercase tracking-widest text-muted mt-1 truncate">{formTag}</p>}
      </div>
    </div>
  )
}

// Portfolio details + publish toggle + share link.
function PortfolioSettings({ portfolio, onChange, onError }) {
  const [title, setTitle] = useState(portfolio.title || '')
  const [studio, setStudio] = useState(portfolio.studio_identity || '')
  const [statement, setStatement] = useState(portfolio.statement || '')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const url = `${window.location.origin}/p/${portfolio.slug}`
  const dirty =
    title !== (portfolio.title || '') ||
    studio !== (portfolio.studio_identity || '') ||
    statement !== (portfolio.statement || '')

  async function handleSave() {
    setSaving(true)
    try {
      const updated = await updatePortfolio(portfolio.id, {
        title: title || null,
        studio_identity: studio || null,
        statement: statement || null,
      })
      onChange(updated)
    } catch (err) {
      onError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handlePublishToggle() {
    setSaving(true)
    try {
      const updated = await updatePortfolio(portfolio.id, { published: !portfolio.published })
      onChange(updated)
    } catch (err) {
      onError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard unavailable */ }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface-raised p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className={`text-xs uppercase tracking-widest font-semibold ${portfolio.published ? 'text-stage-complete' : 'text-muted'}`}>
          {portfolio.published ? 'Published' : 'Draft'}
        </span>
        <button
          onClick={handlePublishToggle}
          disabled={saving}
          className={`px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-50 ${
            portfolio.published
              ? 'border border-line-strong text-ink-soft hover:bg-surface-warm-hover'
              : 'bg-clay text-white hover:bg-clay-dark'
          }`}
        >
          {portfolio.published ? 'Unpublish' : 'Publish'}
        </button>
      </div>

      {portfolio.published && (
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={url}
            className="flex-1 min-w-0 text-sm bg-surface-warm rounded-lg px-3 py-2 text-ink-soft truncate"
          />
          <button
            onClick={handleCopy}
            className="px-3 py-2 rounded-lg border border-line-strong text-sm text-ink-soft cursor-pointer hover:bg-surface-warm-hover shrink-0"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 rounded-lg border border-line-strong text-sm text-ink-soft cursor-pointer hover:bg-surface-warm-hover shrink-0"
          >
            Open
          </a>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <Field label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Your studio name" className="w-full text-sm bg-surface-warm rounded-lg px-3 py-2 text-ink focus:outline-none" />
        </Field>
        <Field label="Studio / location">
          <input value={studio} onChange={(e) => setStudio(e.target.value)} placeholder="e.g. Brooklyn, NY" className="w-full text-sm bg-surface-warm rounded-lg px-3 py-2 text-ink focus:outline-none" />
        </Field>
        <Field label="Artist statement">
          <textarea value={statement} onChange={(e) => setStatement(e.target.value)} rows={3} placeholder="A sentence or two about your work" className="w-full text-sm bg-surface-warm rounded-lg px-3 py-2 text-ink focus:outline-none resize-none" />
        </Field>
        {dirty && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="self-end px-4 py-2 rounded-xl bg-clay text-white text-sm font-semibold cursor-pointer hover:bg-clay-dark disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save details'}
          </button>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-widest text-muted">{label}</span>
      {children}
    </label>
  )
}

// First-run: create the portfolio with a validated vanity slug.
function CreatePortfolio({ user, onCreated, onBack }) {
  const suggested = slugify(user.user_metadata?.full_name || user.email?.split('@')[0] || '')
  const [title, setTitle] = useState(user.user_metadata?.full_name || '')
  const [slug, setSlug] = useState(suggested)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleCreate() {
    const slugError = validateSlug(slug)
    if (slugError) { setError(slugError); return }
    setSaving(true)
    setError(null)
    try {
      const pf = await createPortfolio(user.id, { slug, title })
      onCreated(pf)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface px-6 pt-safe">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs uppercase tracking-widest text-clay font-semibold cursor-pointer hover:text-clay-dark pt-4"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        Board
      </button>

      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full pb-16">
        <h1 className="font-display italic text-4xl text-ink">Create your portfolio.</h1>
        <p className="text-sm text-muted mt-2">Pick a link and a name. You can change these later, and nothing is public until you publish.</p>

        <div className="flex flex-col gap-4 mt-8">
          <Field label="Portfolio name">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Your studio name" className="w-full text-base bg-surface-raised border border-line rounded-xl px-3 py-3 text-ink focus:outline-none focus:border-clay" />
          </Field>
          <Field label="Public link">
            <div className="flex items-center bg-surface-raised border border-line rounded-xl px-3 focus-within:border-clay">
              <span className="text-sm text-muted">/p/</span>
              <input
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                placeholder="your-name"
                className="flex-1 text-base bg-transparent px-1 py-3 text-ink focus:outline-none"
              />
            </div>
          </Field>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            onClick={handleCreate}
            disabled={saving}
            className="bg-clay text-white py-3.5 rounded-2xl font-semibold cursor-pointer hover:bg-clay-dark disabled:opacity-50 mt-2"
          >
            {saving ? 'Creating…' : 'Create portfolio'}
          </button>
        </div>
      </div>
    </div>
  )
}
