// Lightweight, dependency-free client-side observability for Supabase traffic.
//
// Every Supabase HTTP request flows through the wrapped `fetch` in supabase.js,
// which reports here via `recordRequest`. Cache layers (signed URLs in photos.js,
// reference catalogs in catalog.js) report hit/miss via `recordCache`. The /dev
// diagnostics page reads `getSnapshot()` and subscribes for live updates.
//
// Everything lives in module memory (a single SPA session). All writes are wrapped
// so instrumentation can never break an actual request or the app.

// Owner gate for the /dev page — kept here so it's importable without pulling in UI.
export const DEV_OWNER_EMAIL =
  import.meta.env.VITE_DEV_OWNER_EMAIL || 'nicho.delmo@gmail.com'

const MAX_EVENTS = 200

// Ring buffer of recent request events: { ts, label, method, durationMs, status, ok }
const events = []
// label → { count, errors, totalMs, lastMs, maxMs }
const aggregates = new Map()
// cache name → { hits, misses }
const cacheStats = new Map()

const subscribers = new Set()

function notify() {
  for (const fn of subscribers) {
    try { fn() } catch { /* a bad subscriber must not break recording */ }
  }
}

export function recordRequest(evt) {
  try {
    events.push(evt)
    if (events.length > MAX_EVENTS) events.shift()

    let agg = aggregates.get(evt.label)
    if (!agg) {
      agg = { count: 0, errors: 0, totalMs: 0, lastMs: 0, maxMs: 0 }
      aggregates.set(evt.label, agg)
    }
    agg.count += 1
    if (!evt.ok) agg.errors += 1
    agg.totalMs += evt.durationMs
    agg.lastMs = evt.durationMs
    if (evt.durationMs > agg.maxMs) agg.maxMs = evt.durationMs

    notify()
  } catch { /* never let instrumentation throw into a request path */ }
}

export function recordCache(name, { hit }) {
  try {
    let s = cacheStats.get(name)
    if (!s) {
      s = { hits: 0, misses: 0 }
      cacheStats.set(name, s)
    }
    if (hit) s.hits += 1
    else s.misses += 1
    notify()
  } catch { /* ignore */ }
}

// Approximate p95 over the events currently in the buffer for a given label.
function p95ForLabel(label) {
  const durs = events
    .filter((e) => e.label === label)
    .map((e) => e.durationMs)
    .sort((a, b) => a - b)
  if (!durs.length) return 0
  const idx = Math.min(durs.length - 1, Math.floor(durs.length * 0.95))
  return durs[idx]
}

export function getSnapshot() {
  const aggList = []
  for (const [label, a] of aggregates) {
    aggList.push({
      label,
      count: a.count,
      errors: a.errors,
      avgMs: a.count ? Math.round(a.totalMs / a.count) : 0,
      maxMs: Math.round(a.maxMs),
      p95Ms: Math.round(p95ForLabel(label)),
    })
  }
  aggList.sort((a, b) => b.count - a.count)

  const caches = {}
  for (const [name, s] of cacheStats) {
    const total = s.hits + s.misses
    caches[name] = {
      hits: s.hits,
      misses: s.misses,
      hitRate: total ? s.hits / total : 0,
    }
  }

  const totalRequests = aggList.reduce((n, a) => n + a.count, 0)
  const totalErrors = aggList.reduce((n, a) => n + a.errors, 0)

  return {
    totalRequests,
    totalErrors,
    aggregates: aggList,
    caches,
    // Most-recent-first copy of the buffer for the request log.
    recent: events.slice().reverse(),
  }
}

export function reset() {
  events.length = 0
  aggregates.clear()
  cacheStats.clear()
  notify()
}

export function subscribe(fn) {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}
