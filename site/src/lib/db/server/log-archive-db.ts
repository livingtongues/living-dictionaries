import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import process from 'node:process'
import Database from 'better-sqlite3'
import { CLIENT_LOG_COLUMNS, CLIENT_LOGS_TABLE_SQL } from './logs-db'

/**
 * Cold storage for aged-out `client_logs` rows. Kept in a SEPARATE file from
 * `shared.db` (and from the hot `logs.db`) on purpose: it's high-churn, backup-
 * excluded telemetry with zero joins to the rest of the schema. The retention
 * cron moves rows older than the hot window here from `logs.db`, and prunes this
 * file past the archive window.
 *
 * Schema is the `client_logs` table verbatim (shared with logs.db via
 * `CLIENT_LOGS_TABLE_SQL`). No migration runner — created on demand; the
 * column retrofit below ALTER-ADDs any column missing from a pre-existing
 * archive file.
 */

// Re-exported so existing importers keep resolving; the source of truth is logs-db.ts.
export { CLIENT_LOG_COLUMNS } from './logs-db'

/** Column → its ALTER-ADD type, so a retrofit recreates the exact declared shape. */
const ARCHIVE_COLUMN_TYPES: Record<string, string> = {
  latitude: 'REAL',
  longitude: 'REAL',
}

let archive_singleton: Database.Database | null = null

export function get_log_archive_db(): Database.Database {
  if (archive_singleton)
    return archive_singleton
  const data_dir = process.env.DATA_DIR || '.data'
  archive_singleton = open_log_archive_db(`${data_dir}/logs-archive.db`)
  return archive_singleton
}

export function open_log_archive_db(path: string | ':memory:'): Database.Database {
  if (path !== ':memory:')
    mkdirSync(dirname(path), { recursive: true })
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 5000')
  db.exec(`
    ${CLIENT_LOGS_TABLE_SQL}
    CREATE INDEX IF NOT EXISTS idx_archive_client_logs_received_at ON client_logs(received_at DESC);
  `)
  // Retrofit EVERY column missing from a pre-split archive file — not just
  // session_id. An archive created before the geo columns (country/region/city/
  // latitude/longitude) or session_id would otherwise 500 the whole retention
  // sweep when reroll_archived_days_once's rollup_day SELECTs those columns by
  // name ("no such column: country" — the house 2026-07-05 incident).
  const existing = new Set((db.prepare(`SELECT name FROM pragma_table_info('client_logs')`).all() as { name: string }[]).map(row => row.name))
  for (const column of CLIENT_LOG_COLUMNS) {
    if (!existing.has(column))
      db.exec(`ALTER TABLE client_logs ADD COLUMN ${column} ${ARCHIVE_COLUMN_TYPES[column] ?? 'TEXT'}`)
  }
  return db
}

/** Test-only: drop the cached archive handle. */
export function _reset_log_archive_db_for_tests(): void {
  if (archive_singleton) {
    try { archive_singleton.close() } catch { /* already closed */ }
    archive_singleton = null
  }
}
