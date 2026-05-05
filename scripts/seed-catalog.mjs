// Seeds clay_bodies and glazes from supabase/seed/*.json.
// Idempotent: upserts on `slug`. Safe to re-run when the studio updates the range.
//
// Required env (loaded by `npm run seed:catalog` via --env-file=.env.local):
//   VITE_SUPABASE_URL or SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY  (NOT the anon key — must be the service role)

import { createClient } from '@supabase/supabase-js'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const seedDir = resolve(here, '..', 'supabase', 'seed')

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing env. Need SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.')
  console.error('Add SUPABASE_SERVICE_ROLE_KEY to .env.local (Supabase dashboard → Project Settings → API → service_role).')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

async function loadJson(name) {
  const text = await readFile(resolve(seedDir, name), 'utf8')
  return JSON.parse(text)
}

async function upsert(table, rows) {
  const { error, count } = await supabase
    .from(table)
    .upsert(rows, { onConflict: 'slug', count: 'exact' })
  if (error) throw error
  return count ?? rows.length
}

async function main() {
  const [clayBodies, glazes] = await Promise.all([
    loadJson('clay_bodies.json'),
    loadJson('glazes.json'),
  ])

  const clayCount = await upsert('clay_bodies', clayBodies)
  console.log(`✓ Seeded ${clayCount} clay bodies`)

  const glazeCount = await upsert('glazes', glazes)
  console.log(`✓ Seeded ${glazeCount} glazes`)
}

main().catch((err) => {
  console.error('Seed failed:', err.message || err)
  process.exit(1)
})
