import { createClient } from '@supabase/supabase-js'
import { recordRequest } from './diagnostics.js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Derive a coarse, stable label from a Supabase request URL so the diagnostics
// page can group traffic: /rest/v1/<table> → "rest:<table>",
// /storage/v1/object/sign/photos → "storage:sign", /auth/v1/... → "auth".
function labelForUrl(url) {
  try {
    const { pathname } = new URL(url)
    const rest = pathname.match(/\/rest\/v1\/([^/?]+)/)
    if (rest) return `rest:${rest[1]}`
    if (pathname.includes('/storage/v1/')) {
      if (pathname.includes('/object/sign')) return 'storage:sign'
      if (pathname.includes('/object/upload') || pathname.match(/\/object\/[^/]+\/[^/]/)) return 'storage:object'
      return 'storage:other'
    }
    if (pathname.includes('/auth/v1/')) return 'auth'
    return pathname
  } catch {
    return 'unknown'
  }
}

// Time every Supabase request and report it to diagnostics. Transparent: returns
// the original Response and re-throws on failure — instrumentation never alters
// behavior. Cache hits are the *absence* of a request, which is the signal we want.
function instrumentedFetch(input, init) {
  const url = typeof input === 'string' ? input : input?.url || ''
  const method = (init?.method || (typeof input !== 'string' && input?.method) || 'GET').toUpperCase()
  const start = performance.now()

  return fetch(input, init).then(
    (res) => {
      recordRequest({
        ts: Date.now(),
        label: labelForUrl(url),
        method,
        durationMs: performance.now() - start,
        status: res.status,
        ok: res.ok,
      })
      return res
    },
    (err) => {
      recordRequest({
        ts: Date.now(),
        label: labelForUrl(url),
        method,
        durationMs: performance.now() - start,
        status: 0,
        ok: false,
      })
      throw err
    }
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    redirectTo: 'https://pot-heads.studio/auth/callback'
  },
  global: {
    fetch: instrumentedFetch
  }
})
