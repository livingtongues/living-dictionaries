import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import process from 'node:process'
import Database from 'better-sqlite3'

/**
 * Cold storage for aged-out `client_logs` rows. Kept in a SEPARATE file from
 * `shared.db` on purpose: `shared.db` carries the live catalog + sync write-locks,
 * so a high-churn log table would contend for the WAL. The retention cron moves
 * rows older than the hot window here, and prunes this file past the archive window.
 *
 * Schema is the `client_logs` table verbatim (incl. `source` + geo). No migration
 * runner — this file is created on demand; new client_logs columns must be added
 * here too (kept in sync via CLIENT_LOG_COLUMNS).
 */

/** Every `client_logs` column, in INSERT order. Source of truth for archive moves. */
export const CLIENT_LOG_COLUMNS = [
  'id',
  'received_at',
  'client_time',
  'user_id',
  'level',
  'message',
  'stack',
  'url',
  'user_agent',
  'platform',
  'app_version',
  'build_target',
  'context',
  'source',
  'country',
  'region',
  'city',
  'latitude',
  'longitude',
] as const

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
    CREATE TABLE IF NOT EXISTS client_logs (
      id TEXT PRIMARY KEY,
      received_at TEXT NOT NULL,
      client_time TEXT,
      user_id TEXT,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      stack TEXT,
      url TEXT,
      user_agent TEXT,
      platform TEXT,
      app_version TEXT,
      build_target TEXT,
      context TEXT,
      source TEXT,
      country TEXT,
      region TEXT,
      city TEXT,
      latitude REAL,
      longitude REAL
    );
    CREATE INDEX IF NOT EXISTS idx_archive_client_logs_received_at ON client_logs(received_at DESC);
  `)
  return db
}

/** Test-only: drop the cached archive handle. */
export function _reset_log_archive_db_for_tests(): void {
  if (archive_singleton) {
    try { archive_singleton.close() } catch { /* already closed */ }
    archive_singleton = null
  }
}
