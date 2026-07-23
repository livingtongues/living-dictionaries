/**
 * One-off repair: an earlier seed-ledger run inserted every migrated object with
 * `uploaded_at = copied_at` (the created_at collector failed silently), and the
 * INSERT OR IGNORE re-run couldn't fix it. This UPDATEs `uploaded_at` on the
 * migrated keys from the real dict-db created_at dates, then re-runs the
 * monthly backfill. Post-deploy live-upload rows are untouched (their keys
 * aren't in state.db). Idempotent.
 *
 * Usage: pnpm tsx media-migration/repair-ledger-dates.ts
 */
import { docker_exec_node, get_state_db } from './lib'

const CREATED_AT_COLLECTOR = String.raw`
const { readdirSync } = require('fs')
const Database = require('better-sqlite3')
const out = {}
for (const file of readdirSync('/data/dictionaries').filter(f => f.endsWith('.db') && !f.endsWith('.history.db'))) {
  let db
  try { db = new Database('/data/dictionaries/' + file, { readonly: true }) } catch { continue }
  try {
    for (const table of ['audio', 'videos', 'photos']) {
      const has = db.prepare("SELECT 1 FROM sqlite_master WHERE name=?").get(table)
      if (!has) continue
      for (const row of db.prepare('SELECT id, created_at FROM ' + table).all()) out[table + ':' + row.id] = row.created_at
    }
  } catch {} finally { db.close() }
}
console.log(JSON.stringify(out))
`

function build_update_program(rows: { key: string, uploaded_at: string }[]): string {
  return `
const Database = require('better-sqlite3')
const rows = ${JSON.stringify(rows)}
const db = new Database('/data/shared.db')
const update = db.prepare('UPDATE media_objects SET uploaded_at = @uploaded_at WHERE key = @key AND uploaded_at != @uploaded_at')
let updated = 0
db.transaction(() => { for (const row of rows) updated += update.run(row).changes })()
db.close()
console.log(JSON.stringify({ updated, total: rows.length }))`
}

const BACKFILL_PROGRAM = `
const Database = require('better-sqlite3')
const db = new Database('/data/shared.db')
const earliest = db.prepare('SELECT MIN(uploaded_at) AS m FROM media_objects').get().m
if (!earliest) { console.log(JSON.stringify({ months: 0 })); process.exit(0) }
const dates = []
const cursor = new Date(earliest.slice(0, 7) + '-01T00:00:00Z')
const now = new Date()
while (true) {
  const next = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
  const month_end = new Date(next.getTime() - 24 * 3600 * 1000).toISOString().slice(0, 10)
  if (new Date(month_end + 'T23:59:59Z') >= now) break
  dates.push(month_end)
  cursor.setUTCMonth(cursor.getUTCMonth() + 1)
}
const insert = db.prepare(\`
  INSERT OR IGNORE INTO media_storage_daily (date, dict_id, media_type, bytes, object_count)
  SELECT ?, dict_id, media_type, SUM(bytes), COUNT(*) FROM media_objects
  WHERE uploaded_at <= ? GROUP BY dict_id, media_type
\`)
db.transaction(() => { for (const d of dates) insert.run(d, d + 'T23:59:59.999Z') })()
db.close()
console.log(JSON.stringify({ months: dates.length, first: dates[0], last: dates[dates.length - 1] }))`

async function main() {
  const db = get_state_db()
  console.log('Collecting media-row created_at dates from prod (read-only)...')
  const created_at_by_row = JSON.parse(await docker_exec_node({ program: CREATED_AT_COLLECTOR, max_buffer_mb: 64 })) as Record<string, string>
  console.log(`${Object.keys(created_at_by_row).length} media rows dated.`)

  const objects = db.prepare(`
    SELECT tbl, row_id, new_key FROM objects WHERE status IN ('copied', 'rewritten')
  `).all() as { tbl: string, row_id: string, new_key: string }[]
  const variants = db.prepare(`SELECT tbl, row_id, key FROM variants`).all() as { tbl: string, row_id: string, key: string }[]

  const rows: { key: string, uploaded_at: string }[] = []
  const owner_dates = new Map<string, string>()
  for (const object of objects) {
    const uploaded_at = created_at_by_row[`${object.tbl}:${object.row_id}`]
    if (!uploaded_at)
      continue // partner logos / featured images have no dict-db media row — copied_at stands
    owner_dates.set(`${object.tbl}:${object.row_id}`, uploaded_at)
    rows.push({ key: object.new_key, uploaded_at })
  }
  for (const variant of variants) {
    const uploaded_at = owner_dates.get(`${variant.tbl}:${variant.row_id}`)
    if (uploaded_at)
      rows.push({ key: variant.key, uploaded_at })
  }
  console.log(`${rows.length} ledger rows to re-date.`)

  let updated = 0
  for (let start = 0; start < rows.length; start += 20000) {
    const batch = rows.slice(start, start + 20000)
    const result = JSON.parse((await docker_exec_node({ program: build_update_program(batch) })).trim().split('\n').pop()) as { updated: number }
    updated += result.updated
    console.log(`  processed ${Math.min(start + 20000, rows.length)}/${rows.length} (${updated} re-dated)`)
  }

  console.log('Backfilling monthly media_storage_daily history...')
  const backfill = JSON.parse((await docker_exec_node({ program: BACKFILL_PROGRAM })).trim().split('\n').pop())
  console.log('Backfill:', backfill)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
