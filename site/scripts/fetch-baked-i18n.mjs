/**
 * Bake-time translation fetch. Pulls the full non-English translation set
 * from a RUNNING Living Dictionaries server (`GET /api/i18n/export` — during a
 * prod `docker compose build` that's the still-serving old container) and
 * overwrites `src/lib/i18n/locales/**` so the Vite build ships the latest DB
 * values. English files are never touched (code-owned).
 *
 * NEVER fails the build: any error (first-ever deploy, site down, bad shape)
 * leaves the committed files — the last-known-good seed — in place, prints a
 * loud warning, and exits 0.
 *
 * Usage:
 *   node scripts/fetch-baked-i18n.mjs                # prod (Dockerfile bake step)
 *   node scripts/fetch-baked-i18n.mjs http://localhost:3041/api/i18n/export   # dev refresh
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const EXPORT_URL = process.argv[2] || process.env.I18N_EXPORT_URL || 'https://livingdictionaries.app/api/i18n/export'
const LOCALES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', 'i18n', 'locales')

try {
  console.log(`i18n bake: fetching ${EXPORT_URL}`)
  const response = await fetch(EXPORT_URL, { signal: AbortSignal.timeout(30_000) })
  if (!response.ok)
    throw new Error(`HTTP ${response.status}`)
  const { files, generated_at } = await response.json()

  // Validate the full payload BEFORE writing anything — a half-written locale
  // tree with broken JSON would fail the Vite build, which this script must never do.
  if (!files || typeof files !== 'object' || Object.keys(files).length < 10)
    throw new Error(`Suspicious payload: ${Object.keys(files || {}).length} files`)
  for (const [path, content] of Object.entries(files)) {
    if (!/^(?:(?:gl|ps|psAbbrev|sd)\/)?[\w-]+\.json$/.test(path))
      throw new Error(`Unexpected file path in payload: ${path}`)
    if (path.startsWith('en.') || path.endsWith('/en.json'))
      throw new Error(`Payload tried to overwrite an English file: ${path}`)
    if (!content || typeof content !== 'object')
      throw new Error(`Non-object content for ${path}`)
  }

  for (const [path, content] of Object.entries(files)) {
    const target = normalize(join(LOCALES_DIR, path))
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, `${JSON.stringify(content, null, 2)}\r\n`)
  }
  console.log(`i18n bake: wrote ${Object.keys(files).length} locale files (export generated ${generated_at})`)
} catch (error) {
  console.warn('='.repeat(72))
  console.warn(`i18n bake WARNING: could not fetch fresh translations (${error.message}).`)
  console.warn('Building with the COMMITTED locale files instead — they may be stale.')
  console.warn('='.repeat(72))
}
