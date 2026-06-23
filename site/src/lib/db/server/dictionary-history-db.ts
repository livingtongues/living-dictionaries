import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import Database from 'better-sqlite3'
import { run_sql_migrations } from './run-sql-migrations'

/**
 * Per-dictionary change-history SQLite (`/data/dictionaries/<id>.history.db`).
 *
 * A SEPARATE file from the main dict db so history is never synced to clients
 * and never copied into R2 viewer snapshots (the main db + snapshots stay
 * lean). Written at the merge chokepoint via `record_history`, read by the
 * `GET /api/dictionary/[id]/history` endpoint. Server-only.
 */

const migration_files = import.meta.glob('../schemas/history-migrations/*.sql', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>

export const LATEST_HISTORY_MIGRATION = (() => {
  const names = Object.keys(migration_files).map(p => p.split('/').pop()!).sort()
  return names[names.length - 1] || ''
})()

function get_dictionaries_dir(): string {
  return join(process.env.DATA_DIR || '.data', 'dictionaries')
}

/** Absolute path of a dictionary's history SQLite file (may or may not exist). */
export function history_db_path(dict_id: string): string {
  return join(get_dictionaries_dir(), `${dict_id}.history.db`)
}

const db_cache = new Map<string, Database.Database>()

function open_history_db(dict_id: string): Database.Database {
  const dir = get_dictionaries_dir()
  if (!existsSync(dir))
    mkdirSync(dir, { recursive: true })

  const db = new Database(join(dir, `${dict_id}.history.db`))
  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 5000')
  db.pragma('foreign_keys = ON')
  run_sql_migrations({ db, migration_files })
  return db
}

/** Open (or fetch from cache) the per-dict history connection. */
export function get_dictionary_history_db(dict_id: string): Database.Database {
  const cached = db_cache.get(dict_id)
  if (cached)
    return cached
  const db = open_history_db(dict_id)
  db_cache.set(dict_id, db)
  return db
}

export function close_dictionary_history_db(dict_id: string) {
  const cached = db_cache.get(dict_id)
  if (cached) {
    cached.close()
    db_cache.delete(dict_id)
  }
}

export function close_all_dictionary_history_dbs() {
  for (const [, db] of db_cache)
    db.close()
  db_cache.clear()
}

/** Delete a dict's history file + WAL sidecars (admin teardown). */
export function delete_dictionary_history_db_file(dict_id: string): string[] {
  close_dictionary_history_db(dict_id)
  const base = history_db_path(dict_id)
  const removed: string[] = []
  for (const path of [base, `${base}-wal`, `${base}-shm`]) {
    if (existsSync(path)) {
      rmSync(path, { force: true })
      removed.push(path)
    }
  }
  return removed
}

/** For tests: open a history db in memory + run migrations, no caching. */
export function open_dictionary_history_db_in_memory(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  run_sql_migrations({ db, migration_files })
  return db
}

export interface HistoryOwner {
  type: string
  id: string
}

export interface HistoryEvent {
  /** Optional — generated if omitted. */
  id?: string
  table_name: string
  row_id: string
  op: 'insert' | 'update' | 'delete'
  user_id: string
  at: string
  /** After-image (delete = final pre-delete image). Stored as JSON. */
  snapshot: Record<string, unknown>
  /** Update-only column diff `{col:{old,new}}`; null for insert/delete. */
  delta: Record<string, { old?: unknown, new?: unknown }> | null
  owners: HistoryOwner[]
}

/**
 * Append a batch of history events (+ their owners) in one transaction.
 * Best-effort: the caller invokes this AFTER the main-db commit and must
 * swallow/log any error so a history failure never rolls back a real edit.
 */
export function record_history(db: Database.Database, events: HistoryEvent[]) {
  if (!events.length)
    return
  const insert_change = db.prepare(
    `INSERT INTO changes (id, table_name, row_id, op, user_id, at, snapshot, delta)
     VALUES (@id, @table_name, @row_id, @op, @user_id, @at, @snapshot, @delta)`,
  )
  const insert_owner = db.prepare(
    `INSERT OR IGNORE INTO change_owners (change_id, owner_type, owner_id)
     VALUES (?, ?, ?)`,
  )
  const tx = db.transaction((batch: HistoryEvent[]) => {
    for (const event of batch) {
      const id = event.id ?? crypto.randomUUID()
      insert_change.run({
        id,
        table_name: event.table_name,
        row_id: event.row_id,
        op: event.op,
        user_id: event.user_id,
        at: event.at,
        snapshot: JSON.stringify(event.snapshot),
        delta: event.delta ? JSON.stringify(event.delta) : null,
      })
      for (const owner of event.owners)
        insert_owner.run(id, owner.type, owner.id)
    }
  })
  tx(events)
}
