import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import process from 'node:process'
import Database from 'better-sqlite3'
import { run_sql_migrations } from './run-sql-migrations'

const migration_files = import.meta.glob('../schemas/shared-migrations/*.sql', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>

let shared_db: Database.Database | null = null

export function get_shared_db(): Database.Database {
  if (shared_db)
    return shared_db
  const data_dir = process.env.DATA_DIR || '.data'
  shared_db = open_shared_db(`${data_dir}/shared.db`)
  return shared_db
}

export function open_shared_db(path: string | ':memory:'): Database.Database {
  if (path !== ':memory:')
    mkdirSync(dirname(path), { recursive: true })
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 5000')
  db.pragma('foreign_keys = ON')
  run_sql_migrations({ db, migration_files })
  return db
}

let test_template: Buffer | null = null

function get_test_template(): Buffer {
  if (!test_template) {
    const seed = open_shared_db(':memory:')
    test_template = seed.serialize()
    seed.close()
  }
  return test_template
}

/**
 * Test-only: a fresh in-memory shared.db restored from a serialized template.
 * Running all migrations costs ~42ms per open; serialize-once + restore is
 * ~0.2ms, so `beforeEach` setups stay cheap. Per-connection pragmas must be
 * re-applied after restore (`foreign_keys` is per-connection in SQLite).
 */
export function open_test_shared_db(): Database.Database {
  const db = new Database(get_test_template())
  db.pragma('busy_timeout = 5000')
  db.pragma('foreign_keys = ON')
  return db
}

/** Bundled latest migration filename — used by the sync handshake to detect schema drift. */
export const latest_shared_migration_name = (() => {
  const names = Object.keys(migration_files)
    .map(path => path.split('/').pop()!)
    .sort()
  return names[names.length - 1] || ''
})()
