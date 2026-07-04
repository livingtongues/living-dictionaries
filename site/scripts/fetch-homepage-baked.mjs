/**
 * Bake-time homepage data fetch. Pulls platform stats + approved featured word
 * cards from a RUNNING Living Dictionaries server (`GET /api/homepage/export`
 * — during a prod `docker compose build` that's the still-serving old
 * container) and overwrites `src/lib/data/homepage-baked.json` so the Vite
 * build ships fresh numbers/cards with zero runtime cost.
 *
 * NEVER fails the build: any error leaves the committed seed file — the
 * last-known-good bake — in place, prints a loud warning, and exits 0.
 *
 * Usage:
 *   node scripts/fetch-homepage-baked.mjs                # prod (Dockerfile bake step)
 *   node scripts/fetch-homepage-baked.mjs http://localhost:3041/api/homepage/export   # dev refresh
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const EXPORT_URL = process.argv[2] || process.env.HOMEPAGE_EXPORT_URL || 'https://livingdictionaries.app/api/homepage/export'
const TARGET = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', 'data', 'homepage-baked.json')

try {
  console.log(`homepage bake: fetching ${EXPORT_URL}`)
  // stats do a full per-dict scan on first call (~20s on the VPS) — allow for it
  const response = await fetch(EXPORT_URL, { signal: AbortSignal.timeout(120_000) })
  if (!response.ok)
    throw new Error(`HTTP ${response.status}`)
  const payload = await response.json()

  const { stats, featured_entries, generated_at } = payload
  if (!stats || typeof stats.dictionaries !== 'number' || stats.dictionaries < 100)
    throw new Error(`Suspicious stats payload: ${JSON.stringify(stats)}`)
  if (!Array.isArray(featured_entries))
    throw new Error('featured_entries is not an array')

  writeFileSync(TARGET, `${JSON.stringify({ generated_at, stats, featured_entries }, null, 2)}\n`)
  console.log(`homepage bake: wrote stats + ${featured_entries.length} cards (generated ${generated_at})`)
} catch (error) {
  console.warn('='.repeat(72))
  console.warn(`homepage bake FAILED (${error.message}) — keeping the committed seed file`)
  console.warn('='.repeat(72))
}
