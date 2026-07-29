// Runs INSIDE the app container (see README): lists original media objects still
// missing duration (audio/video) or dimensions (photo) as JSON on stdout.
const db = require('better-sqlite3')('/data/shared.db', { readonly: true })
// Pre-deploy (columns not yet migrated) every original is "missing" — dump them all.
const has_columns = db.prepare(`SELECT 1 FROM pragma_table_info('media_objects') WHERE name = 'duration_ms'`).get()
const missing_filter = has_columns
  ? `AND ((media_type IN ('audio', 'video') AND duration_ms IS NULL) OR (media_type = 'photo' AND width IS NULL))`
  : ''
const rows = db.prepare(`
  SELECT key, media_type FROM media_objects
  WHERE is_variant = 0 AND orphaned_at IS NULL ${missing_filter}
`).all()
console.log(JSON.stringify(rows))
