/**
 * Apply a backfill run's `LEDGER` TSV lines to prod shared.db `media_objects`.
 * Run inside the container: `DERIVATIVE_LOG=… SHARED_DB=/data/shared.db node apply-ledger.cjs`
 * Lines: `LEDGER\t{derivative_key}\t{bytes}\t{duration_ms}` — dict_id is parsed
 * from the key. Rows missing duration are left NULL for the metadata probe.
 */
const fs = require('node:fs')
const Database = require('better-sqlite3')

const log = fs.readFileSync(process.env.DERIVATIVE_LOG, 'utf8')
const rows = log.split('\n').filter(line => line.startsWith('LEDGER\t')).map((line) => {
  const [, key, bytes, duration] = line.split('\t')
  const dict_id = key.split('/')[0]
  const duration_ms = Number(duration)
  return { key, dict_id, bytes: Number(bytes), duration_ms: Number.isFinite(duration_ms) && duration_ms > 0 ? duration_ms : null }
})
const db = new Database(process.env.SHARED_DB)
const insert = db.prepare(`
  INSERT INTO media_objects (key, dict_id, media_type, is_variant, bytes, uploaded_at, duration_ms)
  VALUES (@key, @dict_id, 'audio', 1, @bytes, @uploaded_at, @duration_ms)
  ON CONFLICT(key) DO UPDATE SET bytes=excluded.bytes, duration_ms=excluded.duration_ms, orphaned_at=NULL
`)
const uploaded_at = new Date().toISOString()
db.transaction(() => { for (const row of rows) insert.run({ ...row, uploaded_at }) })()
console.log(JSON.stringify({ recorded: rows.length, bytes: rows.reduce((sum, row) => sum + row.bytes, 0) }))
console.log(JSON.stringify(db.prepare(`SELECT COUNT(*) count, SUM(bytes) bytes FROM media_objects WHERE media_type='audio' AND is_variant=1`).get()))
