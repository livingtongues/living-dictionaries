/**
 * Backfill `i18n_translations` rows for a locale from its committed
 * `src/lib/i18n/locales/**` files, for every active `i18n_keys` row that has no
 * translation yet. Each inserted row is `source='ai', needs_review='ai'` so a
 * human reviews it on /translate. Never clobbers an existing row
 * (ON CONFLICT DO NOTHING) and never fabricates a key (only inserts for keys
 * present in `i18n_keys`).
 *
 * Used to seed the `zh-TW` (繁體中文) locale from its OpenCC-generated files, but
 * generic: `node scripts/fill-locale-from-files.mjs <locale> [db_path]`.
 * Default db = `.data/shared.db` (local dev). Prod runs the same script inside
 * the container against `/data/shared.db` — no OpenCC dependency there, the
 * values are read straight from the committed files.
 */
import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const [, , locale, db_path_arg] = process.argv
if (!locale) {
  console.error('usage: node scripts/fill-locale-from-files.mjs <locale> [db_path]')
  process.exit(1)
}
const here = dirname(fileURLToPath(import.meta.url))
const db_path = db_path_arg || join(here, '..', '.data', 'shared.db')
const locales_dir = join(here, '..', 'src', 'lib', 'i18n', 'locales')

/** Flatten committed files (base + gl/ps/psAbbrev/sd) into { key_id: value }. */
function read_locale_values(loc) {
  const files = [`${loc}.json`, `gl/${loc}.json`, `ps/${loc}.json`, `psAbbrev/${loc}.json`, `sd/${loc}.json`]
  const values = {}
  for (const file of files) {
    let content
    try {
      content = JSON.parse(readFileSync(join(locales_dir, file), 'utf8'))
    } catch {
      continue // a locale may not have every section file
    }
    for (const section of Object.keys(content)) {
      for (const item of Object.keys(content[section]))
        values[`${section}.${item}`] = content[section][item]
    }
  }
  return values
}

const values = read_locale_values(locale)
const db = new Database(db_path)
const active_keys = new Set(db.prepare('SELECT id FROM i18n_keys WHERE removed_at IS NULL').all().map(row => row.id))

const insert = db.prepare(`
  INSERT INTO i18n_translations (id, key_id, locale, value, source, needs_review, updated_by_name)
  VALUES (?, ?, ?, ?, 'ai', 'ai', 'AI (${locale} fill)')
  ON CONFLICT (key_id, locale) DO NOTHING`)

let inserted = 0
let skipped_stale = 0
let skipped_empty = 0
const run = db.transaction(() => {
  for (const [key_id, value] of Object.entries(values)) {
    if (!value) { skipped_empty++; continue }
    if (!active_keys.has(key_id)) { skipped_stale++; continue }
    const info = insert.run(randomUUID(), key_id, locale, value)
    inserted += info.changes
  }
})
run()

const total = db.prepare('SELECT count(*) AS c FROM i18n_translations WHERE locale = ?').get(locale).c
console.log(`db: ${db_path}`)
console.log(`locale ${locale}: inserted ${inserted}, skipped ${skipped_stale} stale-key + ${skipped_empty} empty; total ${locale} rows now ${total}`)
db.close()
