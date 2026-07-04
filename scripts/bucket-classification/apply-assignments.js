/**
 * Applies bucket-assignments.csv to the production shared.db. Run AFTER the
 * `20260704a_featured_entries_pivot_and_dictionary_buckets.sql` migration has deployed.
 *
 * Usage (from repo root on a dev machine):
 *   scp scripts/bucket-classification/bucket-assignments.csv living:/tmp/bucket-assignments.csv
 *   ssh living 'sudo mv /tmp/bucket-assignments.csv /opt/hosting/data/bucket-assignments.csv'
 *   ssh living 'docker exec -i sveltekit_blue node' < scripts/bucket-classification/apply-assignments.js
 *   ssh living 'sudo rm /opt/hosting/data/bucket-assignments.csv'
 *
 * Bumps updated_at so admin browser mirrors pull the change on next sync.
 * Deliberately does NOT set dirty (that's the client-push flag — setting it
 * server-side would echo rows back). Idempotent: rows already carrying the
 * assigned bucket are skipped.
 */
const fs = require('node:fs')
const Database = require('better-sqlite3')

const CSV_PATH = '/data/bucket-assignments.csv'
const VALID = new Set(['public', 'unlisted', 'secure', 'conlang', 'glossary', 'delete'])

const db = new Database('/data/shared.db')

const has_bucket_column = db.prepare(`SELECT COUNT(*) AS c FROM pragma_table_info('dictionaries') WHERE name = 'bucket'`).get().c
if (!has_bucket_column)
  throw new Error('dictionaries.bucket column missing — deploy the 20260704b migration first')

const lines = fs.readFileSync(CSV_PATH, 'utf8').trim().split('\n').slice(1)
const update = db.prepare(`
  UPDATE dictionaries
  SET bucket = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = ? AND (bucket IS NULL OR bucket != ?)
`)

let applied = 0
let skipped = 0
let missing = 0
const apply_all = db.transaction(() => {
  for (const line of lines) {
    const match = line.match(/^"(.*)",([a-z]+),/)
    if (!match)
      throw new Error(`bad CSV line: ${line}`)
    const [, id, bucket] = match
    if (!VALID.has(bucket))
      throw new Error(`invalid bucket '${bucket}' for ${id}`)
    const exists = db.prepare('SELECT id FROM dictionaries WHERE id = ?').get(id)
    if (!exists) {
      missing++
      console.warn(`not found (deleted since classification?): ${id}`)
      continue
    }
    const result = update.run(bucket, id, bucket)
    if (result.changes)
      applied++
    else skipped++
  }
})
apply_all()

console.log(JSON.stringify({ applied, skipped_already_set: skipped, missing }, null, 2))
console.log('bucket counts:', db.prepare('SELECT bucket, COUNT(*) AS c FROM dictionaries GROUP BY bucket ORDER BY c DESC').all())
