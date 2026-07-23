/**
 * Stage 4 (PROD-VISIBLE — only run AFTER the dual-read serving code is deployed):
 * per-dict sync-safe storage_path rewrites on the living VPS.
 *
 * Mechanics (researched 2026-07-23, see .issues/media-r2-migration.md):
 *  - Guarded `UPDATE {tbl} SET storage_path = @new WHERE id = @id AND
 *    storage_path = @old` — the per-dict AFTER UPDATE triggers auto-bump
 *    `server_seq` (clients pull the row) and `db_metadata.last_modified_at`.
 *  - `updated_at` is deliberately NOT bumped: preserves LWW so a genuine
 *    concurrent human edit still wins; pulls apply by server_seq regardless.
 *  - Then the dict cursor is mirrored onto shared.db `dictionaries.updated_at`
 *    so the R2 snapshot builder re-snapshots on its normal ≤30-min sweep.
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

function build_remote_program(payload: { dict_id: string, updates: { tbl: string, id: string, old_path: string, new_path: string }[] }): string {
  return `
const Database = require('better-sqlite3')
const payload = ${JSON.stringify(payload)}
const allowed = new Set(['audio', 'videos'])
const db = new Database('/data/dictionaries/' + payload.dict_id + '.db')
const result = { updated: [], already: [], diverged: [] }
db.transaction(() => {
  for (const u of payload.updates) {
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
  shared.close()
}
console.log(JSON.stringify({ updated: result.updated, already: result.already, diverged: result.diverged }))
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
    const program = build_remote_program({
      dict_id,
      updates: rows.map(row => ({ tbl: row.tbl, id: row.row_id, old_path: row.old_path, new_path: row.new_key })),
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
