import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import process from 'node:process'
import Database from 'better-sqlite3'
import { open_test_shared_db } from './shared-db'

/**
 * Hot storage for `client_logs` telemetry, in its OWN file (`logs.db`) — split
 * out of `shared.db` (2026-07-05, LD parity port of house) because raw logs
 * were the bulk of shared.db's bytes, bloating dev pulls of production data +
 * the (per-dict) R2 snapshot machinery, while having zero SQL joins/FKs to the
 * rest of the schema. The forever rollups (`log_daily_metrics`,
 * `log_daily_sessions`) stay in shared.db so trends travel with it; raw rows age
 * into `logs-archive.db` (see log-retention-cron) and neither raw file is backed
 * up — telemetry is reconstructible-enough from the rollups.
 *
 * No migration runner — schema is created on open (same pattern as the archive
 * DB). Retrofit columns with a pragma_table_info check if ever needed.
 */

/** Every `client_logs` column, in INSERT order. Source of truth for cross-file moves. */
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
  'session_id',
  'visitor_id',
  'country',
  'region',
  'city',
  'latitude',
  'longitude',
] as const

/** The `client_logs` table DDL, shared verbatim by logs.db and logs-archive.db. */
export const CLIENT_LOGS_TABLE_SQL = `
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
    session_id TEXT,
    visitor_id TEXT,
    country TEXT,
    region TEXT,
    city TEXT,
    latitude REAL,
    longitude REAL
  );
`

let logs_singleton: Database.Database | null = null

export function get_logs_db(): Database.Database {
  if (logs_singleton)
    return logs_singleton
  // Under vitest, endpoint tests that don't mock this module must not write
  // telemetry into the dev .data/logs.db file — give them a throwaway DB.
  logs_singleton = process.env.VITEST
    ? open_logs_db(':memory:')
    : open_logs_db(`${process.env.DATA_DIR || '.data'}/logs.db`)
  return logs_singleton
}

export function open_logs_db(path: string | ':memory:'): Database.Database {
  if (path !== ':memory:')
    mkdirSync(dirname(path), { recursive: true })
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 5000')
  db.exec(`
    ${CLIENT_LOGS_TABLE_SQL}
    CREATE INDEX IF NOT EXISTS idx_client_logs_received_at ON client_logs(received_at DESC);
    -- Slice indexes so analytics reads only the rows a panel needs (events / nav /
    -- boot-cascade / i18n / api_v1 / uptime / leader_health / perf) instead of
    -- walking the whole hot table per section.
    CREATE INDEX IF NOT EXISTS idx_client_logs_message_received_at ON client_logs(message, received_at);
    -- Plain (level, …) rather than a partial index: SQLite only uses a partial
    -- index when the query's WHERE contains its predicate near-verbatim, so a
    -- \`level IN ('error','crash')\` query can't use a partial
    -- \`level IN ('error','unhandled_rejection','crash')\` index.
    CREATE INDEX IF NOT EXISTS idx_client_logs_level_received_at ON client_logs(level, received_at);
    -- COVERING for unique-users: COUNT(DISTINCT user_id) + the audience probes
    -- (user_agent / session_id) run index-only instead of heap-hopping half the table.
    CREATE INDEX IF NOT EXISTS idx_client_logs_user_id ON client_logs(user_id, received_at, user_agent, session_id) WHERE user_id IS NOT NULL;
    -- COVERING for deploys / errors_by_version' DISTINCT app_version.
    CREATE INDEX IF NOT EXISTS idx_client_logs_app_version ON client_logs(app_version, received_at) WHERE app_version IS NOT NULL;
    -- Covering index for the bot-UA classification's DISTINCT user_agent scan.
    CREATE INDEX IF NOT EXISTS idx_client_logs_user_agent_received_at ON client_logs(user_agent, received_at);
    -- Session-grouped scans (window sessions live tail).
    CREATE INDEX IF NOT EXISTS idx_client_logs_session_id ON client_logs(session_id, received_at) WHERE session_id IS NOT NULL;
  `)
  // Retrofit ANY column missing from a pre-existing logs.db file (CREATE TABLE IF
  // NOT EXISTS never adds columns). Mirrors the archive DB's retrofit so a new
  // column (e.g. `visitor_id`, 2026-07-07) lands on already-created files without a
  // migration runner. TEXT for everything except the REAL geo pair.
  const geo_real = new Set(['latitude', 'longitude'])
  const existing = new Set((db.prepare(`SELECT name FROM pragma_table_info('client_logs')`).all() as { name: string }[]).map(row => row.name))
  for (const column of CLIENT_LOG_COLUMNS) {
    if (!existing.has(column))
      db.exec(`ALTER TABLE client_logs ADD COLUMN ${column} ${geo_real.has(column) ? 'REAL' : 'TEXT'}`)
  }
  return db
}

/**
 * One-time boot migration: move any `client_logs` rows still living in
 * `shared.db` into `logs.db`, drop the table from shared.db, and VACUUM the
 * freed space. Idempotent + crash-safe: the copy is `INSERT OR IGNORE` on the id
 * PK, and once the table is gone this is a no-op. `BEGIN IMMEDIATE` on shared.db
 * serializes the two blue/green containers if both boot at once (the loser sees
 * the table already dropped, or briefly busy-waits). Rows written by a
 * still-running OLD container after the drop fail its inserts ("no such table")
 * — acceptable minutes-long telemetry loss during the one cutover deploy.
 */
export function split_client_logs_from_shared({ shared_db, logs_db }: {
  shared_db: Database.Database
  logs_db: Database.Database
}): { moved: number } {
  const table_exists = (shared_db.prepare(`
    SELECT COUNT(*) n FROM sqlite_master WHERE type = 'table' AND name = 'client_logs'
  `).get() as { n: number }).n > 0
  if (!table_exists)
    return { moved: 0 }

  // Copy only columns that actually exist on the (old) shared.db table. A column
  // added to CLIENT_LOG_COLUMNS AFTER the split shipped (e.g. `visitor_id`,
  // 2026-07-07) is never present on a pre-split shared.db, so SELECTing it by name
  // would 500 this one-time migration ("no such column"). logs.db's target column
  // is left at its DEFAULT (NULL) for those.
  const present = new Set((shared_db.prepare(`SELECT name FROM pragma_table_info('client_logs')`).all() as { name: string }[]).map(row => row.name))
  const copy_columns = CLIENT_LOG_COLUMNS.filter(column => present.has(column))
  const columns = copy_columns.join(', ')
  const placeholders = copy_columns.map(() => '?').join(', ')
  const insert = logs_db.prepare(`INSERT OR IGNORE INTO client_logs (${columns}) VALUES (${placeholders})`)

  let moved = 0
  shared_db.exec('BEGIN IMMEDIATE')
  try {
    const copy_all = logs_db.transaction(() => {
      for (const row of shared_db.prepare(`SELECT ${columns} FROM client_logs`).iterate() as IterableIterator<Record<string, unknown>>) {
        insert.run(...copy_columns.map(column => row[column] ?? null))
        moved++
      }
    })
    copy_all()
    shared_db.exec('DROP TABLE client_logs')
    shared_db.exec('COMMIT')
  } catch (err) {
    try { shared_db.exec('ROLLBACK') } catch { /* not in a tx */ }
    throw err
  }
  try {
    shared_db.exec('VACUUM')
  } catch (err) {
    console.warn('[logs-db] VACUUM after client_logs split failed (space reclaims on next VACUUM):', (err as Error).message)
  }
  console.info(`[logs-db] Split ${moved} client_logs row(s) out of shared.db into logs.db.`)
  return { moved }
}

/** Test-only: drop the cached logs handle. */
export function _reset_logs_db_for_tests(): void {
  if (logs_singleton) {
    try { logs_singleton.close() } catch { /* already closed */ }
    logs_singleton = null
  }
}

if (import.meta.vitest) {
  const { describe, test, expect } = import.meta.vitest
  describe(split_client_logs_from_shared, () => {
    test('moves rows, drops the shared table, and is idempotent', () => {
      const shared_db = open_test_shared_db()
      const logs_db = open_logs_db(':memory:')
      shared_db.prepare(`
        INSERT INTO client_logs (id, received_at, level, message) VALUES (?, ?, ?, ?)
      `).run('log-1', '2026-07-01T00:00:00.000Z', 'info', 'session_start')
      shared_db.prepare(`
        INSERT INTO client_logs (id, received_at, level, message, session_id) VALUES (?, ?, ?, ?, ?)
      `).run('log-2', '2026-07-02T00:00:00.000Z', 'error', 'boom', 'sess-1')

      const first = split_client_logs_from_shared({ shared_db, logs_db })
      expect(first.moved).toBe(2)
      const rows = logs_db.prepare('SELECT id, message, session_id FROM client_logs ORDER BY id').all()
      expect(rows).toEqual([
        { id: 'log-1', message: 'session_start', session_id: null },
        { id: 'log-2', message: 'boom', session_id: 'sess-1' },
      ])
      const shared_has_table = (shared_db.prepare(`SELECT COUNT(*) n FROM sqlite_master WHERE type='table' AND name='client_logs'`).get() as { n: number }).n
      expect(shared_has_table).toBe(0)

      const second = split_client_logs_from_shared({ shared_db, logs_db })
      expect(second.moved).toBe(0)
    })

    test('re-running after a crash between copy and drop does not duplicate rows', () => {
      const shared_db = open_test_shared_db()
      const logs_db = open_logs_db(':memory:')
      shared_db.prepare(`
        INSERT INTO client_logs (id, received_at, level, message) VALUES ('log-1', '2026-07-01T00:00:00.000Z', 'info', 'x')
      `).run()
      // Simulate the crash case: row already copied but shared table still present.
      logs_db.prepare(`
        INSERT INTO client_logs (id, received_at, level, message) VALUES ('log-1', '2026-07-01T00:00:00.000Z', 'info', 'x')
      `).run()
      const result = split_client_logs_from_shared({ shared_db, logs_db })
      expect(result.moved).toBe(1) // iterated, but INSERT OR IGNORE deduped
      const count = (logs_db.prepare('SELECT COUNT(*) n FROM client_logs').get() as { n: number }).n
      expect(count).toBe(1)
    })
  })
}
