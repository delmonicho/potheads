import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPieces, STAGES } from '../lib/pieces.js'
import { getPhotosForPieces, getPhotoUrls } from '../lib/photos.js'
import { getTagsForPieces } from '../lib/tags.js'
import {
  getMyPortfolio, createPortfolio, updatePortfolio,
  getPortfolioItems, showcasePiece, setItemShowcased,
  updatePortfolioItem, reorderItems,
  buildItemSnapshot, slugify, validateSlug,
} from '../lib/portfolio.js'
import PotteryPlaceholder from '../components/PotteryPlaceholder.jsx'
import SegmentedControl from '../components/SegmentedControl.jsx'
import PortfolioItemEditor from '../components/portfolio/PortfolioItemEditor.jsx'

export default function PortfolioCurate({ user }) {
  const navigate = useNavigate()
  const [portfolio, setPortfolio] = useState(null)
  const [pieces, setPieces] = useState([])
  const [thumbUrls, setThumbUrls] = useState({})
  const [formTags, setFormTags] = useState({})
  const [tagsByPiece, setTagsByPiece] = useState(new Map())
  const [items, setItems] = useState(new Map()) // pieceId → item row
  const [order, setOrder] = useState([])         // showcased pieceIds, display order
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingItem, setEditingItem] = useState(null) // item row being label-edited
  const [savingItem, setSavingItem] = useState(false)
  const [itemError, setItemError] = useState(null)

  const orderRef = useRef([])
  const applyOrder = useCallback((next) => { orderRef.current = next; setOrder(next) }, [])

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
      applyOrder(itemRows.filter((it) => it.showcased).sort((a, b) => a.position - b.position).map((it) => it.piece_id))

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
  }, [user.id, applyOrder])

  useEffect(() => { load() }, [load])

  const pieceById = useMemo(() => new Map(pieces.map((p) => [p.id, p])), [pieces])

  async function handleToggle(piece) {
    const existing = items.get(piece.id)
    const isOn = existing?.showcased
    try {
      if (isOn) {
        setItems((prev) => new Map(prev).set(piece.id, { ...existing, showcased: false }))
        applyOrder(orderRef.current.filter((id) => id !== piece.id))
        await setItemShowcased(portfolio.id, piece.id, false)
      } else {
        const snapshot = buildItemSnapshot(piece, tagsByPiece.get(piece.id) || [])
        const position = orderRef.current.length
        const row = await showcasePiece(portfolio.id, piece, snapshot, position)
        setItems((prev) => new Map(prev).set(piece.id, row))
        applyOrder([...orderRef.current, piece.id])
      }
    } catch (err) {
      setError(err.message)
      load()
    }
  }

  async function commitOrder(next) {
    applyOrder(next)
    try {
      const itemIds = next.map((pid) => items.get(pid)?.id).filter(Boolean)
      await reorderItems(itemIds)
      setItems((prev) => {
        const m = new Map(prev)
        next.forEach((pid, i) => { const it = m.get(pid); if (it) m.set(pid, { ...it, position: i }) })
        return m
      })
    } catch (err) {
      setError(err.message)
      load()
    }
  }

  async function handleSaveLabel(fields) {
    setSavingItem(true)
    setItemError(null)
    try {
      const updated = await updatePortfolioItem(editingItem.id, fields)
      setItems((prev) => new Map(prev).set(updated.piece_id, updated))
      setEditingItem(null)
    } catch (err) {
      setItemError(err.message)
    } finally {
      setSavingItem(false)
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
          <span className="text-xs uppercase tracking-widest text-muted">{order.length} showcased</span>
        </div>
        <h1 className="font-display italic text-4xl text-ink pb-3">Portfolio.</h1>
      </header>

      <main className="flex-1 overflow-y-auto px-5 py-5 pb-24 flex flex-col gap-6">
        {error && <p className="text-red-600 text-sm text-center">{error}</p>}

        <PortfolioSettings portfolio={portfolio} onChange={setPortfolio} onError={setError} />

        {order.length > 0 && (
          <ShowcasedList
            order={order}
            items={items}
            pieceById={pieceById}
            thumbUrls={thumbUrls}
            formTags={formTags}
            onReorder={commitOrder}
            onEdit={(pieceId) => { setItemError(null); setEditingItem(items.get(pieceId)) }}
            onRemove={(pieceId) => handleToggle(pieceById.get(pieceId))}
          />
        )}

        <div>
          <p className="text-xs uppercase tracking-widest text-muted mb-3">Tap pieces to showcase</p>
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

      {editingItem && (
        <PortfolioItemEditor
          key={editingItem.id}
          open={!!editingItem}
          onClose={() => setEditingItem(null)}
          item={editingItem}
          onSave={handleSaveLabel}
          saving={savingItem}
          error={itemError}
        />
      )}
    </div>
  )
}

// Ordered, drag-reorderable list of showcased items. Tap a row to edit its
// label; drag the handle to reorder (pointer events → works on touch + mouse).
function ShowcasedList({ order, items, pieceById, thumbUrls, formTags, onReorder, onEdit, onRemove }) {
  const listRef = useRef(null)
  const [dragId, setDragId] = useState(null)
  // Live reorder preview during a drag; null when not dragging. Committed (and
  // persisted) on pointer up so we don't write to the DB on every move.
  const [preview, setPreview] = useState(null)
  // display is the order to render: the live preview while dragging, else the
  // committed order. pointerMove/pointerUp are re-bound each render, so they
  // close over the current display without needing a ref.
  const display = preview || order

  function pointerDown(e, pieceId) {
    e.preventDefault()
    setDragId(pieceId)
    setPreview(order)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  function pointerMove(e) {
    if (!dragId || !listRef.current) return
    const current = display
    const others = current.filter((id) => id !== dragId)
    const y = e.clientY
    // Insertion index = first other row whose midpoint is below the pointer.
    // Rects reflect the current displayed order, so this stays consistent.
    let insertAt = others.length
    for (let k = 0; k < others.length; k++) {
      const row = listRef.current.querySelector(`[data-piece-id="${others[k]}"]`)
      if (!row) continue
      const r = row.getBoundingClientRect()
      if (y < r.top + r.height / 2) { insertAt = k; break }
    }
    const next = [...others.slice(0, insertAt), dragId, ...others.slice(insertAt)]
    if (next.join() !== current.join()) setPreview(next)
  }

  function pointerUp() {
    if (!dragId) return
    const final = display
    setDragId(null)
    setPreview(null)
    if (final.join() !== order.join()) onReorder(final)
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-muted mb-3">Showcased · drag to reorder</p>
      <div ref={listRef} className="flex flex-col gap-2">
        {display.map((pieceId) => {
          const item = items.get(pieceId)
          const piece = pieceById.get(pieceId)
          if (!item || !piece) return null
          return (
            <div
              key={pieceId}
              data-piece-id={pieceId}
              className={`flex items-center gap-3 rounded-xl border border-line bg-surface-raised p-2 transition-shadow ${dragId === pieceId ? 'shadow-lg opacity-90' : ''}`}
            >
              <button
                onPointerDown={(e) => pointerDown(e, pieceId)}
                onPointerMove={pointerMove}
                onPointerUp={pointerUp}
                className="touch-none px-1 text-muted cursor-grab active:cursor-grabbing hover:text-ink-soft"
                aria-label="Drag to reorder"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="6" r="1.6" /><circle cx="8" cy="12" r="1.6" /><circle cx="8" cy="18" r="1.6" /><circle cx="16" cy="6" r="1.6" /><circle cx="16" cy="12" r="1.6" /><circle cx="16" cy="18" r="1.6" /></svg>
              </button>

              <button onClick={() => onEdit(pieceId)} className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer text-left hover:opacity-80">
                <span className="w-12 h-12 rounded-lg overflow-hidden bg-tan shrink-0 block">
                  {thumbUrls[pieceId] ? (
                    <img src={thumbUrls[pieceId]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <PotteryPlaceholder formTag={formTags[pieceId] ?? null} />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink truncate">{item.title || piece.name}</span>
                  <span className="block text-[11px] text-muted truncate">
                    {[item.form, item.year].filter(Boolean).join(' · ') || 'Tap to edit label'}
                  </span>
                </span>
              </button>

              <button
                onClick={() => onRemove(pieceId)}
                className="w-8 h-8 rounded-full text-muted flex items-center justify-center cursor-pointer hover:bg-surface-warm-hover shrink-0"
                aria-label="Remove from portfolio"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
          )
        })}
      </div>
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
          <img src={thumbUrl} alt="" className={`w-full h-full object-cover transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`} onLoad={() => setImgLoaded(true)} />
        ) : (
          <PotteryPlaceholder formTag={formTag} />
        )}
      </div>
      <div className={`absolute inset-0 rounded-2xl transition-colors ${showcased ? 'bg-clay/20' : ''}`}>
        <div className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${showcased ? 'bg-clay border-clay' : 'bg-white/70 border-white'}`}>
          {showcased && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2 6 5 9 10 3" /></svg>
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

  async function patch(fields) {
    setSaving(true)
    try {
      const updated = await updatePortfolio(portfolio.id, fields)
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
        <div className="flex items-center gap-2">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 rounded-xl border border-line-strong text-sm text-ink-soft cursor-pointer hover:bg-surface-warm-hover"
          >
            Preview
          </a>
          <button
            onClick={() => patch({ published: !portfolio.published })}
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
      </div>

      {portfolio.published && (
        <div className="flex items-center gap-2">
          <input readOnly value={url} className="flex-1 min-w-0 text-sm bg-surface-warm rounded-lg px-3 py-2 text-ink-soft truncate" />
          <button onClick={handleCopy} className="px-3 py-2 rounded-lg border border-line-strong text-sm text-ink-soft cursor-pointer hover:bg-surface-warm-hover shrink-0">
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}

      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted mb-2">Layout</p>
        <SegmentedControl
          ariaLabel="Layout"
          value={portfolio.layout}
          onChange={(v) => patch({ layout: v })}
          options={[{ value: 'editorial', label: 'Editorial' }, { value: 'masonry', label: 'Masonry' }]}
        />
      </div>

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
            onClick={() => patch({ title: title || null, studio_identity: studio || null, statement: statement || null })}
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
              <input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} placeholder="your-name" className="flex-1 text-base bg-transparent px-1 py-3 text-ink focus:outline-none" />
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
