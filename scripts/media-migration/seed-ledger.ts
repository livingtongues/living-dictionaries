/**
 * Stage 6: seed the server-only shared.db media ledger (`media_objects`) +
 * backfill `media_storage_daily` monthly history — run AFTER rewrites, on the
 * deployed schema (the 20260723a migration must exist on prod).
 *
 *  - Ledger rows come from state.db (`objects` with status rewritten/copied +
 *    the photo `variants`), i.e. exact R2 byte sizes.
 *  - `uploaded_at` = the media row's dict-db `created_at` (collected live) so
 *    the one-time trend backfill reflects real historical growth (of surviving
 *    objects — deleted-before-migration media is invisible, by design).
 *    Partner logos / featured images / variants inherit their owner's date
 *    (fallback: copied_at).
 *  - Backfill = month-end cumulative points from the earliest upload through
 *    last month, then the sweep cron's daily rollup takes over.
 *
 * INSERT OR IGNORE everywhere — post-deploy uploads already in the live ledger
 * win over the seed. Idempotent.
 *
 * Usage: pnpm tsx media-migration/seed-ledger.ts
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

const TYPE_BY_TABLE: Record<string, string> = {
  audio: 'audio',
  videos: 'video',
  photos: 'photo',
  partner_logos: 'photo',
  featured_image: 'photo',
}

interface LedgerRow { key: string, dict_id: string, media_type: string, is_variant: number, bytes: number, uploaded_at: string }

function build_seed_program(rows: LedgerRow[]): string {
  return `
const Database = require('better-sqlite3')
const rows = ${JSON.stringify(rows)}
const db = new Database('/data/shared.db')
const insert = db.prepare('INSERT OR IGNORE INTO media_objects (key, dict_id, media_type, is_variant, bytes, uploaded_at) VALUES (@key, @dict_id, @media_type, @is_variant, @bytes, @uploaded_at)')
let inserted = 0
db.transaction(() => { for (const row of rows) inserted += insert.run(row).changes })()
db.close()
console.log(JSON.stringify({ inserted, total: rows.length }))
`
}

function build_backfill_program(): string {
  return `
const Database = require('better-sqlite3')
const db = new Database('/data/shared.db')
const earliest = db.prepare('SELECT MIN(uploaded_at) AS m FROM media_objects').get().m
if (!earliest) { console.log(JSON.stringify({ months: 0 })); process.exit(0) }
const dates = []
const cursor = new Date(earliest.slice(0, 7) + '-01T00:00:00Z')
const now = new Date()
while (true) {
  // month-END point: first day of next month minus one day
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
console.log(JSON.stringify({ months: dates.length, first: dates[0], last: dates[dates.length - 1] }))
`
}

async function main() {
  const db = get_state_db()
  console.log('Collecting media-row created_at dates from prod (read-only)...')
  const created_at_by_row = JSON.parse(await docker_exec_node({ program: CREATED_AT_COLLECTOR })) as Record<string, string>
  console.log(`${Object.keys(created_at_by_row).length} media rows dated.`)

  const objects = db.prepare(`
    SELECT tbl, row_id, dict_id, new_key, bytes, copied_at FROM objects WHERE status IN ('copied', 'rewritten')
  `).all() as { tbl: string, row_id: string, dict_id: string, new_key: string, bytes: number, copied_at: string }[]
  const variants = db.prepare(`SELECT tbl, row_id, variant, key, bytes FROM variants`).all() as { tbl: string, row_id: string, variant: string, key: string, bytes: number }[]

  const uploaded_at_of = (tbl: string, row_id: string, copied_at: string) =>
    created_at_by_row[`${tbl}:${row_id}`] ?? copied_at ?? new Date().toISOString()

  const rows: LedgerRow[] = []
  const owner_dates = new Map<string, { dict_id: string, uploaded_at: string }>()
  for (const object of objects) {
    const uploaded_at = uploaded_at_of(object.tbl, object.row_id, object.copied_at)
    owner_dates.set(`${object.tbl}:${object.row_id}`, { dict_id: object.dict_id, uploaded_at })
    rows.push({
      key: object.new_key,
      dict_id: object.dict_id,
      media_type: TYPE_BY_TABLE[object.tbl],
      is_variant: 0,
      bytes: object.bytes,
      uploaded_at,
    })
  }
  for (const variant of variants) {
    const owner = owner_dates.get(`${variant.tbl}:${variant.row_id}`)
    if (!owner)
      continue // owner not copied/rewritten (missing/error) — no ledger row
    rows.push({ key: variant.key, dict_id: owner.dict_id, media_type: 'photo', is_variant: 1, bytes: variant.bytes, uploaded_at: owner.uploaded_at })
  }
  console.log(`${rows.length} ledger rows to seed (${objects.length} originals + ${rows.length - objects.length} variants).`)

  let inserted = 0
  for (let start = 0; start < rows.length; start += 20000) {
    const batch = rows.slice(start, start + 20000)
    const result = JSON.parse((await docker_exec_node({ program: build_seed_program(batch) })).trim().split('\n').pop()) as { inserted: number }
    inserted += result.inserted
    console.log(`  seeded ${Math.min(start + 20000, rows.length)}/${rows.length} (${inserted} new)`)
  }

  console.log('Backfilling monthly media_storage_daily history...')
  const backfill = JSON.parse((await docker_exec_node({ program: build_backfill_program() })).trim().split('\n').pop())
  console.log('Backfill:', backfill)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
