/**
 * Stage 1 (photos): build the photo copy manifest from prod (read-only).
 *
 * Three surfaces:
 *   - dict.db `photos` rows            → tbl 'photos'        (new key uuid = row id)
 *   - shared.db partner logos          → tbl 'partner_logos' (fresh uuid — not a photos row)
 *   - shared.db dictionaries.featured_image → tbl 'featured_image' (fresh uuid; row_id = dict id)
 *
 * A surface row with no usable storage_path but a serving_url gets `old_path`
 * `lh3:{hash}` — the copy stage fetches the original via the lh3 `=s0` url.
 * Rows already on the new convention are skipped (idempotent re-runs/sweeps).
 *
 * Usage: pnpm tsx media-migration/pull-manifest-photos.ts
 */
import { randomUUID } from 'node:crypto'
import { build_r2_media_key, extract_media_extension, is_r2_media_path } from '../../site/src/lib/utils/media-path'
import { docker_exec_node, get_state_db, iso_now } from './lib'

const COLLECTOR = String.raw`
const { readdirSync } = require('fs')
const Database = require('better-sqlite3')
const shared = new Database('/data/shared.db', { readonly: true })
const catalog = new Set(shared.prepare('SELECT id FROM dictionaries').all().map(r => r.id))
const out = { dicts: [], partner_logos: [], featured_images: [] }
for (const row of shared.prepare('SELECT id, dictionary_id, photo_storage_path, photo_serving_url FROM dictionary_partners WHERE photo_storage_path IS NOT NULL OR photo_serving_url IS NOT NULL').all()) {
  if (catalog.has(row.dictionary_id)) out.partner_logos.push(row)
}
for (const row of shared.prepare("SELECT id, featured_image FROM dictionaries WHERE featured_image IS NOT NULL AND featured_image != 'null' AND featured_image != ''").all()) {
  try {
    const image = JSON.parse(row.featured_image)
    if (image && (image.storage_path || image.serving_url)) out.featured_images.push({ dict_id: row.id, storage_path: image.storage_path ?? null, serving_url: image.serving_url ?? null })
  } catch {}
}
const files = readdirSync('/data/dictionaries').filter(f => f.endsWith('.db') && !f.endsWith('.history.db'))
for (const file of files) {
  const dict_id = file.slice(0, -3)
  if (!catalog.has(dict_id)) continue
  let db
  try { db = new Database('/data/dictionaries/' + file, { readonly: true }) } catch { continue }
  try {
    const has_photos = db.prepare("SELECT 1 FROM sqlite_master WHERE name='photos'").get()
    if (!has_photos) continue
    const photos = db.prepare('SELECT id, storage_path, serving_url FROM photos').all()
    if (photos.length) out.dicts.push({ dict_id, photos })
  } catch (err) {
    console.error(dict_id, err.message)
  } finally { db.close() }
}
console.log(JSON.stringify(out))
`

interface PhotoRow { id: string, storage_path: string | null, serving_url: string | null }
interface Manifest {
  dicts: { dict_id: string, photos: PhotoRow[] }[]
  partner_logos: { id: string, dictionary_id: string, photo_storage_path: string | null, photo_serving_url: string | null }[]
  featured_images: { dict_id: string, storage_path: string | null, serving_url: string | null }[]
}

function source_path({ storage_path, serving_url }: { storage_path: string | null, serving_url: string | null }): string | null {
  if (storage_path?.trim())
    return storage_path.trim()
  if (serving_url?.trim())
    return `lh3:${serving_url.trim().replace('\n', '')}`
  return null
}

async function main() {
  console.log('Collecting photo manifest from prod (read-only)...')
  const raw = await docker_exec_node({ program: COLLECTOR })
  const manifest = JSON.parse(raw) as Manifest
  console.log(`${manifest.dicts.length} dicts with photos; ${manifest.partner_logos.length} partner logos; ${manifest.featured_images.length} featured images`)

  const db = get_state_db()
  const insert = db.prepare(`
    INSERT INTO objects (dict_id, tbl, row_id, old_path, new_key)
    VALUES (@dict_id, @tbl, @row_id, @old_path, @new_key)
    ON CONFLICT (tbl, row_id) DO UPDATE SET
      old_path = excluded.old_path, new_key = excluded.new_key
      WHERE old_path != excluded.old_path
  `)
  const upsert_dict = db.prepare(`
    INSERT INTO dicts (dict_id, manifested_at) VALUES (?, ?)
    ON CONFLICT (dict_id) DO UPDATE SET manifested_at = excluded.manifested_at
  `)

  const extension_of = (path: string) => path.startsWith('lh3:') ? 'jpg' : extract_media_extension(path)

  let total = 0
  let already_new = 0
  let skipped_no_source = 0
  db.transaction(() => {
    for (const dict of manifest.dicts) {
      upsert_dict.run(dict.dict_id, iso_now())
      for (const row of dict.photos) {
        if (row.storage_path && is_r2_media_path(row.storage_path)) {
          already_new++
          continue
        }
        const old_path = source_path({ storage_path: row.storage_path, serving_url: row.serving_url })
        if (!old_path) {
          skipped_no_source++
          continue
        }
        insert.run({
          dict_id: dict.dict_id,
          tbl: 'photos',
          row_id: row.id,
          old_path,
          new_key: build_r2_media_key({ dict_id: dict.dict_id, kind: 'photo', media_id: row.id, extension: extension_of(old_path) }),
        })
        total++
      }
    }
    for (const logo of manifest.partner_logos) {
      if (logo.photo_storage_path && is_r2_media_path(logo.photo_storage_path)) {
        already_new++
        continue
      }
      const old_path = source_path({ storage_path: logo.photo_storage_path, serving_url: logo.photo_serving_url })
      if (!old_path) {
        skipped_no_source++
        continue
      }
      upsert_dict.run(logo.dictionary_id, iso_now())
      insert.run({
        dict_id: logo.dictionary_id,
        tbl: 'partner_logos',
        row_id: logo.id,
        old_path,
        // fresh uuid — partner logos aren't photos rows, so no row id to reuse
        new_key: build_r2_media_key({ dict_id: logo.dictionary_id, kind: 'photo', media_id: randomUUID(), extension: extension_of(old_path) }),
      })
      total++
    }
    for (const image of manifest.featured_images) {
      if (image.storage_path && is_r2_media_path(image.storage_path)) {
        already_new++
        continue
      }
      const old_path = source_path(image)
      if (!old_path) {
        skipped_no_source++
        continue
      }
      upsert_dict.run(image.dict_id, iso_now())
      insert.run({
        dict_id: image.dict_id,
        tbl: 'featured_image',
        row_id: image.dict_id,
        old_path,
        new_key: build_r2_media_key({ dict_id: image.dict_id, kind: 'photo', media_id: randomUUID(), extension: extension_of(old_path) }),
      })
      total++
    }
  })()

  const by_status = db.prepare(`SELECT status, COUNT(*) c FROM objects WHERE tbl IN ('photos','partner_logos','featured_image') GROUP BY status`).all()
  console.log(`Manifested ${total} photo objects (${already_new} already new-convention, ${skipped_no_source} with no usable source).`)
  console.log('Photo state totals:', by_status)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
