// One-off: backfill `users.last_visit_at` from the telemetry in logs.db.
//
// Before 2026-07-12, `last_visit_at` was only ever written by the admin
// shared.db sync engine, so the /admin/users "active last 30 days" filter only
// ever listed admins. The fix records `last_visit_at` for EVERY authenticated
// visit going forward (root +layout.server.ts). This script seeds history so
// the filter is accurate immediately: for each user seen in `client_logs`, set
// `last_visit_at` to their most recent log timestamp (only when it's newer than
// whatever is already stored, so we never clobber a fresher value).
//
// The `users_after_last_visit_at_bump_updated_at` trigger bumps `updated_at`,
// so every admin client pulls the change on its next sync.
//
// Run inside the app container (better-sqlite3 + /data mount):
//   ssh living 'docker exec -i sveltekit_blue node' < scripts/one-off/2026-07-12-backfill-last-visit-from-logs.cjs
// Back up shared.db first:
//   ssh living 'sudo cp /opt/hosting/data/shared.db /opt/hosting/data/shared.db.bak-$(date -u +%Y%m%d-%H%M%S)'
// Pass DRY=1 to preview without writing.
//
// Locally: DATA_DIR=site/.data node scripts/one-off/2026-07-12-backfill-last-visit-from-logs.cjs

const data_dir = process.env.DATA_DIR || '/data'
const dry = process.env.DRY === '1'

const logs_db = require('better-sqlite3')(`${data_dir}/logs.db`, { readonly: true })
const shared_db = require('better-sqlite3')(`${data_dir}/shared.db`)

const log_visits = logs_db.prepare(`
  SELECT user_id, MAX(received_at) AS last_seen
  FROM client_logs
  WHERE user_id IS NOT NULL
  GROUP BY user_id
`).all()

console.log(`Found ${log_visits.length} distinct users in client_logs`)

// Only advances last_visit_at — never rewinds it below a fresher stored value.
const bump = shared_db.prepare(`
  UPDATE users
  SET last_visit_at = ?
  WHERE id = ?
    AND (last_visit_at IS NULL OR last_visit_at < ?)
`)

let updated = 0
let missing = 0
const apply = shared_db.transaction(() => {
  for (const { user_id, last_seen } of log_visits) {
    const exists = shared_db.prepare('SELECT 1 FROM users WHERE id = ?').get(user_id)
    if (!exists) {
      missing++
      continue
    }
    if (dry) {
      const row = shared_db.prepare('SELECT last_visit_at FROM users WHERE id = ?').get(user_id)
      if (row.last_visit_at === null || row.last_visit_at < last_seen) {
        console.log(`DRY set ${user_id}: ${JSON.stringify(row.last_visit_at)} → ${last_seen}`)
        updated++
      }
      continue
    }
    const info = bump.run(last_seen, user_id, last_seen)
    if (info.changes > 0)
      updated++
  }
})
apply()

console.log(`\n${dry ? '[dry run] would update' : 'updated'} ${updated} users` +
  `${missing ? ` (${missing} log user_ids had no matching users row)` : ''}`)
