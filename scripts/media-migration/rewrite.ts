/**
 * Stage 4 (PROD-VISIBLE — only run AFTER the dual-read serving code is deployed):
 * per-dict sync-safe storage_path rewrites on the living VPS.
 *
 * Mechanics (researched 2026-07-23, see .issues/media-r2-migration.md):
 *  - dict.db tables (audio/videos/photos): guarded `UPDATE {tbl} SET storage_path
 *    = @new WHERE id = @id AND storage_path = @old` — the per-dict AFTER UPDATE
 *    triggers auto-bump `server_seq` (clients pull the row) and
 *    `db_metadata.last_modified_at`. `updated_at` deliberately NOT bumped:
 *    preserves LWW so a genuine concurrent human edit still wins.
 *  - Then the dict cursor is mirrored onto shared.db `dictionaries.updated_at`
 *    so the R2 snapshot builder re-snapshots on its normal ≤30-min sweep.
 *  - Photo extras (Phase 2): rewritten photos rows also backfill
 *    `featured_entries.photo_storage_path` (server-only, by dict_id+photo_id).
 *  - shared.db surfaces: 'partner_logos' → dictionary_partners.photo_storage_path
 *    (dirty=1 + updated_at, mirroring the partners endpoint); 'featured_image' →
 *    dictionaries.featured_image JSON storage_path (dirty=1 + updated_at,
 *    mirroring the catalog endpoint). serving_url values are KEPT as the lh3
 *    failsafe — photo_src prefers the new-convention storage_path.
 *  - A row whose current storage_path equals neither old nor new ('diverged',
 *    e.g. rewritten by a concurrent client push of a stale row) is left alone —
 *    the post-flip sweep (re-run of the whole pipeline) reconciles it.
 *
 * Only dicts with `dicts.verified_at` set (stage 3) are eligible.
 *
 * Usage: pnpm tsx media-migration/rewrite.ts --confirm-dual-read-deployed [--dict=<id>] [--limit-dicts=N]
 */
import { docker_exec_node, get_state_db, iso_now } from './lib'

interface UpdateRow { tbl: string, row_id: string, old_path: string, new_key: string }

const DICT_TABLES = new Set(['audio', 'videos', 'photos'])
const SHARED_TABLES = new Set(['partner_logos', 'featured_image'])

function build_remote_program(payload: {
  dict_id: string
  dict_updates: { tbl: string, id: string, old_path: string, new_path: string }[]
  shared_updates: { tbl: string, id: string, old_path: string, new_path: string }[]
}): string {
  return `
const Database = require('better-sqlite3')
const payload = ${JSON.stringify(payload)}
const allowed = new Set(['audio', 'videos', 'photos'])
const result = { updated: [], already: [], diverged: [] }
const now = new Date().toISOString()

if (payload.dict_updates.length) {
  const db = new Database('/data/dictionaries/' + payload.dict_id + '.db')
  db.transaction(() => {
    for (const u of payload.dict_updates) {
      if (!allowed.has(u.tbl)) throw new Error('bad table ' + u.tbl)
      const info = db.prepare('UPDATE ' + u.tbl + ' SET storage_path = @new_path WHERE id = @id AND storage_path = @old_path').run(u)
      if (info.changes === 1) { result.updated.push(u.tbl + ':' + u.id); continue }
      const current = db.prepare('SELECT storage_path FROM ' + u.tbl + ' WHERE id = ?').get(u.id)
      if (current && current.storage_path === u.new_path) result.already.push(u.tbl + ':' + u.id)
      else result.diverged.push(u.tbl + ':' + u.id)
    }
  })()
  const cursor = db.prepare("SELECT value FROM db_metadata WHERE key = 'last_modified_at'").get()
  db.close()
  if (result.updated.length && cursor) {
    const shared = new Database('/data/shared.db')
    shared.prepare('UPDATE dictionaries SET updated_at = ? WHERE id = ?').run(cursor.value, payload.dict_id)
    // Server-only homepage snapshot: keep the denormalized photo path in step.
    const updated_set = new Set(result.updated)
    const backfill = shared.prepare('UPDATE featured_entries SET photo_storage_path = ? WHERE dict_id = ? AND photo_id = ?')
    for (const u of payload.dict_updates) {
      if (u.tbl === 'photos' && updated_set.has('photos:' + u.id)) backfill.run(u.new_path, payload.dict_id, u.id)
    }
    shared.close()
  }
}

if (payload.shared_updates.length) {
  const shared = new Database('/data/shared.db')
  shared.transaction(() => {
    for (const u of payload.shared_updates) {
      if (u.tbl === 'partner_logos') {
        // old_path may be 'lh3:{hash}' (no storage_path at source) — then guard on the serving hash instead.
        const guard = u.old_path.startsWith('lh3:')
          ? shared.prepare("UPDATE dictionary_partners SET photo_storage_path = ?, dirty = 1, updated_at = ? WHERE id = ? AND dictionary_id = ? AND (photo_storage_path IS NULL OR photo_storage_path = '') AND photo_serving_url = ?")
              .run(u.new_path, now, u.id, payload.dict_id, u.old_path.slice(4))
          : shared.prepare('UPDATE dictionary_partners SET photo_storage_path = ?, dirty = 1, updated_at = ? WHERE id = ? AND dictionary_id = ? AND photo_storage_path = ?')
              .run(u.new_path, now, u.id, payload.dict_id, u.old_path)
        if (guard.changes === 1) { result.updated.push(u.tbl + ':' + u.id); continue }
        const current = shared.prepare('SELECT photo_storage_path FROM dictionary_partners WHERE id = ?').get(u.id)
        if (current && current.photo_storage_path === u.new_path) result.already.push(u.tbl + ':' + u.id)
        else result.diverged.push(u.tbl + ':' + u.id)
      } else if (u.tbl === 'featured_image') {
        const row = shared.prepare('SELECT featured_image FROM dictionaries WHERE id = ?').get(u.id)
        let image = null
        try { image = JSON.parse(row?.featured_image ?? 'null') } catch {}
        if (!image) { result.diverged.push(u.tbl + ':' + u.id); continue }
        if (image.storage_path === u.new_path) { result.already.push(u.tbl + ':' + u.id); continue }
        const matches = u.old_path.startsWith('lh3:')
          ? (!image.storage_path && image.serving_url && image.serving_url.replace('\\n', '') === u.old_path.slice(4))
          : image.storage_path === u.old_path
        if (!matches) { result.diverged.push(u.tbl + ':' + u.id); continue }
        image.storage_path = u.new_path
        shared.prepare('UPDATE dictionaries SET featured_image = ?, dirty = 1, updated_at = ? WHERE id = ?')
          .run(JSON.stringify(image), now, u.id)
        result.updated.push(u.tbl + ':' + u.id)
      } else {
        throw new Error('bad shared table ' + u.tbl)
      }
    }
  })()
  shared.close()
}
console.log(JSON.stringify(result))
`
}

async function main() {
  if (!process.argv.includes('--confirm-dual-read-deployed')) {
    console.error('REFUSING: pass --confirm-dual-read-deployed only once the dual-read serving flip is live on prod — rewritten rows 404 for synced clients otherwise.')
    process.exit(1)
  }
  const dict_filter = process.argv.find(a => a.startsWith('--dict='))?.slice(7)
  const limit_dicts = Number(process.argv.find(a => a.startsWith('--limit-dicts='))?.slice(14) ?? 0)

  const db = get_state_db()
  const dicts = db.prepare(`
    SELECT d.dict_id FROM dicts d
    WHERE d.verified_at IS NOT NULL
      AND EXISTS (SELECT 1 FROM objects o WHERE o.dict_id = d.dict_id AND o.status = 'copied')
      ${dict_filter ? 'AND d.dict_id = ?' : ''}
    ORDER BY d.dict_id ${limit_dicts ? `LIMIT ${limit_dicts}` : ''}
  `).all(...dict_filter ? [dict_filter] : []) as { dict_id: string }[]
  console.log(`${dicts.length} verified dicts with rows to rewrite.`)

  const get_rows = db.prepare(`SELECT tbl, row_id, old_path, new_key FROM objects WHERE dict_id = ? AND status = 'copied'`)
  const mark = db.prepare(`UPDATE objects SET status = 'rewritten', rewritten_at = ? WHERE tbl = ? AND row_id = ?`)
  const mark_dict = db.prepare(`UPDATE dicts SET rewritten_at = ? WHERE dict_id = ?`)

  let total_updated = 0
  let total_diverged = 0
  for (const [index, { dict_id }] of dicts.entries()) {
    const rows = get_rows.all(dict_id) as UpdateRow[]
    const to_update = (allowed: Set<string>) => rows
      .filter(row => allowed.has(row.tbl))
      .map(row => ({ tbl: row.tbl, id: row.row_id, old_path: row.old_path, new_path: row.new_key }))
    const program = build_remote_program({
      dict_id,
      dict_updates: to_update(DICT_TABLES),
      shared_updates: to_update(SHARED_TABLES),
    })
    const output = await docker_exec_node({ program })
    const result = JSON.parse(output.trim().split('\n').pop()) as { updated: string[], already: string[], diverged: string[] }
    const now = iso_now()
    db.transaction(() => {
      for (const key of [...result.updated, ...result.already]) {
        const [tbl, row_id] = key.split(':')
        mark.run(now, tbl, row_id)
      }
      mark_dict.run(now, dict_id)
    })()
    total_updated += result.updated.length + result.already.length
    total_diverged += result.diverged.length
    console.log(`[${index + 1}/${dicts.length}] ${dict_id}: ${result.updated.length} updated, ${result.already.length} already, ${result.diverged.length} diverged`)
  }
  console.log(`DONE: ${total_updated} rows rewritten, ${total_diverged} diverged (left for the post-flip sweep).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
