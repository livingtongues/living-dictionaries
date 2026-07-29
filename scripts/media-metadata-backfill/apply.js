// Runs INSIDE the app container (see README): applies /data/media-metadata.jsonl
// to shared.db media_objects. Dry-run by default; APPLY=1 writes in one
// transaction. COALESCE keeps any value the app has already recorded since the probe.
const fs = require('fs')
const Database = require('better-sqlite3')

const records = fs.readFileSync('/data/media-metadata.jsonl', 'utf8')
  .split('\n').filter(line => line.trim()).map(line => JSON.parse(line))
const durations = records.filter(record => record.duration_ms)
const dimensions = records.filter(record => record.width)
console.log(`plan: fill duration_ms on ${durations.length} rows, width/height on ${dimensions.length} rows`)

if (process.env.APPLY !== '1') {
  console.log('dry run — set APPLY=1 to write')
  process.exit(0)
}

const db = new Database('/data/shared.db')
const update = db.prepare(`
  UPDATE media_objects SET
    duration_ms = COALESCE(duration_ms, @duration_ms),
    width = COALESCE(width, @width),
    height = COALESCE(height, @height)
  WHERE key = @key
`)
let updated = 0
let missing = 0
db.transaction(() => {
  for (const record of records) {
    const result = update.run({ duration_ms: null, width: null, height: null, ...record })
    result.changes ? updated++ : missing++
  }
})()
console.log(`updated ${updated} rows (${missing} keys no longer in the ledger)`)
console.log('integrity_check:', db.pragma('integrity_check', { simple: true }))
const summary = db.prepare(`
  SELECT media_type,
    SUM(CASE WHEN is_variant = 0 THEN 1 ELSE 0 END) AS originals,
    SUM(CASE WHEN is_variant = 0 AND duration_ms IS NOT NULL THEN 1 ELSE 0 END) AS with_duration,
    ROUND(SUM(duration_ms) / 3600000.0, 1) AS hours,
    SUM(CASE WHEN is_variant = 0 AND width IS NOT NULL THEN 1 ELSE 0 END) AS with_dimensions
  FROM media_objects GROUP BY media_type
`).all()
console.log(JSON.stringify(summary, null, 1))
