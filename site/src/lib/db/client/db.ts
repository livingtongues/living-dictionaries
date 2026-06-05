import type { SyncableTableName } from '$lib/db/sync/types'
import type { SqliteConnection } from './connection'
import type { LiveDb } from './live/live-db.svelte'
import { ADMIN_DB_ID_FOR_USER_PREFIX } from '$lib/constants'
import { create_sqlite_connection } from './connection'
import { create_live_db } from './live/live-db.svelte.js'

/**
 * Admin local DB — wa-sqlite in the browser, mirrors the admin-visible subset
 * of `shared.db`. Each admin gets their own IndexedDB instance, keyed by a
 * UUID stored in localStorage so a single browser profile can be reused across
 * sessions.
 *
 * Server-only tables (`email_codes`, `email_aliases`, `client_logs`) get
 * created on the client too (same migration files run on both) but stay empty
 * — `SYNCABLE_TABLE_NAMES` in `db/sync/types.ts` excludes them.
 */

const migration_files = import.meta.glob('../schemas/shared-migrations/*.sql', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>

function get_db_id(user_id: string) {
  const key = ADMIN_DB_ID_FOR_USER_PREFIX + user_id
  const existing = localStorage.getItem(key)
  if (existing)
    return existing
  const fresh = crypto.randomUUID()
  localStorage.setItem(key, fresh)
  return fresh
}

interface AdminDbBundle {
  connection: SqliteConnection
  live_db: LiveDb
}

let bundle_instance: AdminDbBundle | null = null
let bundle_promise: Promise<AdminDbBundle> | null = null

export interface OpenAdminDbOptions {
  on_dirty?: (table_name: SyncableTableName) => void
}

export async function get_admin_db(user_id: string, options: OpenAdminDbOptions = {}): Promise<AdminDbBundle> {
  if (bundle_instance)
    return bundle_instance
  if (!bundle_promise)
    bundle_promise = open_admin_db(user_id, options)
  bundle_instance = await bundle_promise
  return bundle_instance
}

export async function delete_admin_db_and_reload(user_id: string) {
  try {
    if (bundle_instance) {
      await bundle_instance.connection.delete_db()
      bundle_instance = null
      bundle_promise = null
    }
  } catch (err) {
    console.error('Failed to delete admin db:', err)
  }
  localStorage.removeItem(ADMIN_DB_ID_FOR_USER_PREFIX + user_id)
  location.reload()
}

async function open_admin_db(user_id: string, options: OpenAdminDbOptions): Promise<AdminDbBundle> {
  const db_id = get_db_id(user_id)
  const connection = await create_sqlite_connection(db_id)

  const was_resumed = await check_if_resumed(connection)
  const applied = await run_needed_migrations(connection, was_resumed)

  if (!was_resumed) {
    await connection.execute(
      `INSERT INTO db_metadata (key, value) VALUES (?, ?)`,
      ['db_id', db_id],
    )
    await connection.execute(
      `INSERT INTO db_metadata (key, value) VALUES (?, ?)`,
      ['created_at', new Date().toISOString()],
    )
  }

  for (const name of applied) {
    await connection.execute(
      `INSERT INTO migrations (id, name, run_on) VALUES (?, ?, ?)`,
      [crypto.randomUUID(), name, new Date().toISOString()],
    )
  }

  const live_db = create_live_db(connection, { log: true, on_dirty: options.on_dirty })
  return { connection, live_db }
}

async function check_if_resumed(connection: SqliteConnection): Promise<boolean> {
  try {
    const tables = await connection.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
    )
    return tables.length > 0
  } catch {
    return false
  }
}

async function run_needed_migrations(connection: SqliteConnection, was_resumed: boolean): Promise<string[]> {
  let existing: string[] = []
  if (was_resumed) {
    try {
      const result = await connection.query<{ name: string }>(`SELECT name FROM migrations`)
      existing = result.map(row => row.name)
    } catch {
      // migrations table not created yet
    }
  }
  const applied: string[] = []
  for (const path of Object.keys(migration_files).sort()) {
    const name = path.split('/').pop()!
    if (existing.includes(name))
      continue
    await connection.exec_raw(migration_files[path])
    applied.push(name)
  }
  return applied
}

export async function reset_sync_metadata(): Promise<void> {
  if (!bundle_instance)
    throw new Error('Admin DB not initialized')
  await bundle_instance.connection.execute(`DELETE FROM db_metadata WHERE key = 'synced_up_to'`)
}

/** Bundled latest migration filename — used by the sync handshake. */
export const latest_client_migration_name = (() => {
  const names = Object.keys(migration_files).map(p => p.split('/').pop()!).sort()
  return names[names.length - 1] || ''
})()
