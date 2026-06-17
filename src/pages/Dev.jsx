import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import { supabase } from '../lib/supabase.js'
import { getSnapshot, reset, subscribe } from '../lib/diagnostics.js'
import { getUrlCacheStats, clearUrlCache } from '../lib/photos.js'
import { getCatalogCacheStats, clearCatalogCache } from '../lib/catalog.js'

const SUPABASE_PROJECT_REF = 'kkagpnsekzsupwswnryo'
const DASHBOARD_REPORTS_URL = `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}/reports/database`
const METRICS_DOCS_URL = 'https://supabase.com/docs/guides/telemetry/metrics'

function pct(n) {
  return `${Math.round(n * 100)}%`
}

// Bytes a localStorage value occupies (UTF-16 ≈ 2 bytes/char; rough but useful).
function storageBytes(key) {
  try {
    const v = localStorage.getItem(key)
    return v ? v.length * 2 : 0
  } catch {
    return 0
  }
}

function fmtBytes(b) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(2)} MB`
}

const POTHEADS_KEYS = [
  'potheads_signed_urls',
  'potheads_catalog_cache',
  'potheads_tag_colors',
  'potheads_recent_tag_colors',
  'potheads_last_clay_body',
  'potheads.prefs.theme',
  'potheads.prefs.density',
]

function Section({ title, children }) {
  return (
    <section className="mb-6">
      <h2 className="text-xs uppercase tracking-widest text-muted font-semibold mb-2">{title}</h2>
      <div className="bg-surface-raised rounded-2xl border border-line p-4">{children}</div>
    </section>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
      <span className="text-muted shrink-0">{label}</span>
      <span className="text-ink font-mono text-right break-all">{value}</span>
    </div>
  )
}

export default function Dev() {
  const navigate = useNavigate()
  const [snap, setSnap] = useState(() => getSnapshot())
  const [cacheTick, setCacheTick] = useState(0)
  const [session, setSession] = useState(null)

  // Live request stats: re-snapshot whenever diagnostics records something.
  useEffect(() => {
    const unsub = subscribe(() => setSnap(getSnapshot()))
    return unsub
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
  }, [])

  const urlStats = getUrlCacheStats()
  const catalogStats = getCatalogCacheStats()
  // cacheTick is read so clearing caches forces a re-render of the stats above.
  void cacheTick

  const refreshCaches = useCallback(() => setCacheTick((n) => n + 1), [])

  const signedCache = snap.caches.signedUrls
  const catalogCache = snap.caches.catalog

  const totalStorage = POTHEADS_KEYS.reduce((n, k) => n + storageBytes(k), 0)

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      <PageHeader title="Diagnostics." onBack={() => navigate('/board')} />

      <main className="flex-1 px-4 py-4 pb-safe">
        <Section title="Session">
          <Row label="User" value={session?.user?.email || '—'} />
          <Row label="User ID" value={session?.user?.id || '—'} />
          <Row
            label="Session expires"
            value={session?.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : '—'}
          />
        </Section>

        <Section title="Supabase requests">
          <Row label="Total requests" value={snap.totalRequests} />
          <Row label="Errors" value={snap.totalErrors} />
          {snap.aggregates.length === 0 && (
            <p className="text-sm text-muted mt-2">No requests recorded yet this session.</p>
          )}
          {snap.aggregates.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted text-left">
                    <th className="font-medium pb-1 pr-2">Label</th>
                    <th className="font-medium pb-1 px-2 text-right">N</th>
                    <th className="font-medium pb-1 px-2 text-right">Err</th>
                    <th className="font-medium pb-1 px-2 text-right">Avg</th>
                    <th className="font-medium pb-1 px-2 text-right">p95</th>
                    <th className="font-medium pb-1 pl-2 text-right">Max</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {snap.aggregates.map((a) => (
                    <tr key={a.label} className="border-t border-line">
                      <td className="py-1 pr-2 text-ink break-all">{a.label}</td>
                      <td className="py-1 px-2 text-right text-ink">{a.count}</td>
                      <td className={`py-1 px-2 text-right ${a.errors ? 'text-red-600' : 'text-muted'}`}>{a.errors}</td>
                      <td className="py-1 px-2 text-right text-ink">{a.avgMs}</td>
                      <td className="py-1 px-2 text-right text-ink">{a.p95Ms}</td>
                      <td className="py-1 pl-2 text-right text-ink">{a.maxMs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="Recent calls">
          {snap.recent.length === 0 && <p className="text-sm text-muted">Nothing yet.</p>}
          {snap.recent.length > 0 && (
            <ul className="max-h-64 overflow-y-auto text-xs font-mono space-y-1">
              {snap.recent.slice(0, 60).map((e, i) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  <span className={`shrink-0 w-10 ${e.ok ? 'text-stage-complete' : 'text-red-600'}`}>{e.status}</span>
                  <span className="text-muted shrink-0 w-10">{e.method}</span>
                  <span className="text-ink truncate flex-1">{e.label}</span>
                  <span className="text-muted shrink-0">{Math.round(e.durationMs)}ms</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Caches">
          <Row
            label="Signed URLs"
            value={`${urlStats.fresh}/${urlStats.entries} fresh · ${
              signedCache ? `${pct(signedCache.hitRate)} hit (${signedCache.hits}/${signedCache.hits + signedCache.misses})` : 'no reads'
            }`}
          />
          <Row
            label="Catalog · clay"
            value={catalogStats.clayCached ? `cached (${catalogStats.clayRows} rows)` : 'empty'}
          />
          <Row
            label="Catalog · glazes"
            value={
              catalogStats.glazeUsers
                ? `${catalogStats.glazeRows} rows / ${catalogStats.glazeUsers} user(s)`
                : 'empty'
            }
          />
          <Row
            label="Catalog hit rate"
            value={catalogCache ? `${pct(catalogCache.hitRate)} (${catalogCache.hits}/${catalogCache.hits + catalogCache.misses})` : 'no reads'}
          />
        </Section>

        <Section title="localStorage footprint">
          {POTHEADS_KEYS.map((k) => {
            const b = storageBytes(k)
            return b > 0 ? <Row key={k} label={k} value={fmtBytes(b)} /> : null
          })}
          <div className="border-t border-line mt-2 pt-2">
            <Row label="Total" value={fmtBytes(totalStorage)} />
          </div>
        </Section>

        <Section title="Actions">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { clearUrlCache(); refreshCaches() }}
              className="text-xs uppercase tracking-widest font-semibold text-clay border border-line rounded-full px-4 py-2 cursor-pointer hover:bg-clay-tint"
            >
              Clear signed URLs
            </button>
            <button
              onClick={() => { clearCatalogCache(); refreshCaches() }}
              className="text-xs uppercase tracking-widest font-semibold text-clay border border-line rounded-full px-4 py-2 cursor-pointer hover:bg-clay-tint"
            >
              Clear catalog cache
            </button>
            <button
              onClick={() => { reset(); setSnap(getSnapshot()) }}
              className="text-xs uppercase tracking-widest font-semibold text-clay border border-line rounded-full px-4 py-2 cursor-pointer hover:bg-clay-tint"
            >
              Reset request log
            </button>
          </div>
        </Section>

        <Section title="Native metrics">
          <p className="text-sm text-muted mb-3">
            Server-side DB metrics live in the Supabase dashboard. The privileged Prometheus
            <code className="font-mono"> /metrics</code> endpoint needs service-role access, so it isn't
            wired into the client — these are deep links.
          </p>
          <div className="flex flex-col gap-2">
            <a
              href={DASHBOARD_REPORTS_URL}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-clay underline cursor-pointer hover:text-clay-dark"
            >
              Supabase dashboard → Database reports ↗
            </a>
            <a
              href={METRICS_DOCS_URL}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-clay underline cursor-pointer hover:text-clay-dark"
            >
              Telemetry & metrics docs ↗
            </a>
          </div>
        </Section>
      </main>
    </div>
  )
}
