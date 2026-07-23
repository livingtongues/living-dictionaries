/**
 * Stage 1: build the copy manifest from the LIVE prod dict DBs (read-only).
 *
 * One SSH round trip: a collector program runs inside the app container against
 * /data, emitting JSON of every audio/video row with a storage_path, restricted
 * to dictionaries present in the shared.db catalog (orphan DB files of deleted
 * dicts are skipped per the locked plan). Rows already on the NEW convention are
 * filtered locally (makes re-runs/the post-flip sweep naturally idempotent).
 *
 * Usage: pnpm tsx media-migration/pull-manifest.ts
 */
import { build_r2_media_key, extract_media_extension, is_r2_media_path } from '../../site/src/lib/utils/media-path'
import { docker_exec_node, get_state_db, iso_now } from './lib'

const COLLECTOR = String.raw`
const { readdirSync } = require('fs')
const Database = require('better-sqlite3')
const shared = new Database('/data/shared.db', { readonly: true })
const catalog = new Set(shared.prepare('SELECT id FROM dictionaries').all().map(r => r.id))
const files = readdirSync('/data/dictionaries').filter(f => f.endsWith('.db') && !f.endsWith('.history.db'))
const out = { dicts: [], orphan_db_files: [] }
for (const file of files) {
  const dict_id = file.slice(0, -3)
  if (!catalog.has(dict_id)) { out.orphan_db_files.push(dict_id); continue }
  let db
  try { db = new Database('/data/dictionaries/' + file, { readonly: true }) } catch { continue }
  try {
    const has_audio = db.prepare("SELECT 1 FROM sqlite_master WHERE name='audio'").get()
    if (!has_audio) continue
    const audio = db.prepare('SELECT id, storage_path FROM audio WHERE storage_path IS NOT NULL').all()
    const videos = db.prepare('SELECT id, storage_path FROM videos WHERE storage_path IS NOT NULL').all()
    if (audio.length || videos.length) out.dicts.push({ dict_id, audio, videos })
  } catch (err) {
    console.error(dict_id, err.message)
  } finally { db.close() }
}
console.log(JSON.stringify(out))
`

interface ManifestRow { id: string, storage_path: string }
interface Manifest {
  dicts: { dict_id: string, audio: ManifestRow[], videos: ManifestRow[] }[]
  orphan_db_files: string[]
}

async function main() {
  console.log('Collecting manifest from prod (read-only)...')
  const raw = await docker_exec_node({ program: COLLECTOR })
  const manifest = JSON.parse(raw) as Manifest
  console.log(`${manifest.dicts.length} dicts with media; ${manifest.orphan_db_files.length} orphan db files skipped:`, manifest.orphan_db_files.join(', ') || '(none)')

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

  let total = 0
  let already_new = 0
  db.transaction(() => {
    for (const dict of manifest.dicts) {
      upsert_dict.run(dict.dict_id, iso_now())
      for (const { tbl, kind, rows } of [
        { tbl: 'audio', kind: 'audio' as const, rows: dict.audio },
        { tbl: 'videos', kind: 'video' as const, rows: dict.videos },
      ]) {
        for (const row of rows) {
          if (is_r2_media_path(row.storage_path)) {
            already_new++
            continue
          }
          insert.run({
            dict_id: dict.dict_id,
            tbl,
            row_id: row.id,
            old_path: row.storage_path,
            new_key: build_r2_media_key({
              dict_id: dict.dict_id,
              kind,
              media_id: row.id,
              extension: extract_media_extension(row.storage_path),
            }),
          })
          total++
        }
      }
    }
  })()

  const by_status = db.prepare(`SELECT status, COUNT(*) c, SUM(bytes) b FROM objects GROUP BY status`).all()
  console.log(`Manifested ${total} old-convention rows (${already_new} already on the new convention — skipped).`)
  console.log('State totals:', by_status)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
