import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import Database from 'better-sqlite3'
import { get_shared_db } from './shared-db'
import { run_sql_migrations } from './run-sql-migrations'

/**
 * Per-dictionary SQLite (`/data/dictionaries/<dict_id>.db`).
 *
 * LRU + idle-timeout connection cache pattern ported from house's
 * `user-db.ts`. SQLite connections are cheap to open but each one holds a
 * `mmap` + WAL file handle, so per-request open/close on a busy editor would
 * thrash. Cap at MAX_CACHE_SIZE so a multi-tenant burst can't exhaust FDs.
 */

const migration_files = import.meta.glob('../schemas/dictionary-migrations/*.sql', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>

/** Lazily computed bundled latest migration name (for `dict_db_schema_version`). */
export const LATEST_DICT_MIGRATION = (() => {
  const names = Object.keys(migration_files).map(p => p.split('/').pop()!).sort()
  return names[names.length - 1] || ''
})()

function get_dictionaries_dir(): string {
  return join(process.env.DATA_DIR || '.data', 'dictionaries')
}

const db_cache = new Map<string, { db: Database.Database, last_used: number }>()
const IDLE_TIMEOUT_MS = 5 * 60 * 1000
const MAX_CACHE_SIZE = 100

let cleanup_interval: ReturnType<typeof setInterval> | null = null

function start_cleanup() {
  if (cleanup_interval)
    return
  cleanup_interval = setInterval(() => {
    const now = Date.now()
    for (const [dict_id, entry] of db_cache) {
      if (now - entry.last_used > IDLE_TIMEOUT_MS) {
        entry.db.close()
        db_cache.delete(dict_id)
      }
    }
  }, 60_000)
}

function evict_least_recently_used() {
  let oldest_key: string | null = null
  let oldest_time = Number.POSITIVE_INFINITY
  for (const [dict_id, entry] of db_cache) {
    if (entry.last_used < oldest_time) {
      oldest_time = entry.last_used
      oldest_key = dict_id
    }
  }
  if (oldest_key) {
    db_cache.get(oldest_key)!.db.close()
    db_cache.delete(oldest_key)
  }
}

/**
 * Open (or fetch from cache) the per-dict better-sqlite3 connection.
 * Applies any pending migrations on first open + updates
 * `shared.db.dictionaries.dict_db_schema_version`.
 */
export function get_dictionary_db(dict_id: string): Database.Database {
  const cached = db_cache.get(dict_id)
  if (cached) {
    cached.last_used = Date.now()
    return cached.db
  }

  if (db_cache.size >= MAX_CACHE_SIZE)
    evict_least_recently_used()

  const db = open_dictionary_db(dict_id)
  db_cache.set(dict_id, { db, last_used: Date.now() })
  start_cleanup()
  return db
}

function open_dictionary_db(dict_id: string): Database.Database {
  const dir = get_dictionaries_dir()
  if (!existsSync(dir))
    mkdirSync(dir, { recursive: true })

  const db_path = join(dir, `${dict_id}.db`)
  const db = new Database(db_path)
  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 5000')
  db.pragma('foreign_keys = ON')

  run_sql_migrations({ db, migration_files })

  // Self-identify + maintain schema_version. dict_id is set on first open;
  // subsequent reopens leave it alone (no-op via INSERT OR IGNORE).
  db.prepare(`INSERT OR IGNORE INTO db_metadata (key, value) VALUES (?, ?)`).run('dictionary_id', dict_id)
  db.prepare(`INSERT OR REPLACE INTO db_metadata (key, value) VALUES (?, ?)`).run('schema_version', LATEST_DICT_MIGRATION)

  // Push the version into shared.db so the snapshot builder can target only
  // up-to-date dicts. Best-effort; failure here doesn't block the open.
  try {
    const shared = get_shared_db()
    shared.prepare(`UPDATE dictionaries SET dict_db_schema_version = ? WHERE id = ?`).run(LATEST_DICT_MIGRATION, dict_id)
  } catch (err) {
    console.warn(`Could not update dict_db_schema_version for ${dict_id}:`, err)
  }

  return db
}

export function close_dictionary_db(dict_id: string) {
  const cached = db_cache.get(dict_id)
  if (cached) {
    cached.db.close()
    db_cache.delete(dict_id)
  }
}

export function close_all_dictionary_dbs() {
  for (const [, entry] of db_cache)
    entry.db.close()
  db_cache.clear()
  if (cleanup_interval) {
    clearInterval(cleanup_interval)
    cleanup_interval = null
  }
}

/** Test-only peek at cache size. */
export function _cache_size_for_tests(): number {
  return db_cache.size
}

/** For tests: open a dict.db in memory + run migrations, no caching. */
export function open_dictionary_db_in_memory(dict_id: string): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  run_sql_migrations({ db, migration_files })
  db.prepare(`INSERT OR IGNORE INTO db_metadata (key, value) VALUES (?, ?)`).run('dictionary_id', dict_id)
  db.prepare(`INSERT OR REPLACE INTO db_metadata (key, value) VALUES (?, ?)`).run('schema_version', LATEST_DICT_MIGRATION)
  return db
}

/** Read `db_metadata.last_modified_at` (the sync cursor). Returns null if never written. */
export function read_last_modified_at(db: Database.Database): string | null {
  const row = db.prepare(`SELECT value FROM db_metadata WHERE key = 'last_modified_at'`).get() as { value: string } | undefined
  return row?.value ?? null
}

/** Read `db_metadata.dictionary_id` for defensive self-identification. */
export function read_dictionary_id(db: Database.Database): string | null {
  const row = db.prepare(`SELECT value FROM db_metadata WHERE key = 'dictionary_id'`).get() as { value: string } | undefined
  return row?.value ?? null
}
