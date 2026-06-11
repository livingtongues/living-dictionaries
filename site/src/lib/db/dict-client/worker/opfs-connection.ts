/**
 * wa-sqlite + the single-owner OPFS VFS (`opfs-sah-vfs.js`) bootstrap. Runs
 * ONLY inside a dedicated worker (OPFS `createSyncAccessHandle` is exposed
 * nowhere else) and ONLY in the leader (the held SAH is exclusive per file
 * across the origin — that exclusivity IS our single-writer guarantee).
 *
 * This replaces the `IDBBatchAtomicVFS` (IndexedDB) bootstrap in
 * `viewer-client/library-connection.ts` + `client/connection.ts`. OPFS writes
 * pages in place at ~1x instead of IndexedDB→LevelDB's 10–55x write
 * amplification (the disk-thrash freeze root cause).
 *
 * Also exports raw OPFS file helpers used for the viewer snapshot drop-in:
 * write the downloaded `.db` bytes to the real OPFS path BEFORE opening it.
 */

import { OpfsSingleOwnerVFS } from './opfs-sah-vfs.js'

const DB_CACHE_SIZE = '-8192' // 8 MB; set before journal_mode (journal rides in cache)

export interface OpfsConnection {
  query: <T>(sql: string, params?: unknown[]) => Promise<T[]>
  execute: (sql: string, params?: unknown[]) => Promise<void>
  exec_raw: (sql: string) => Promise<void>
  close: () => Promise<void>
  /** OPFS persists across sessions. */
  is_persistent: boolean
}

export interface OpenOpfsOptions {
  /** OPFS path, e.g. `house/library.db` or `house/admin-<user_id>.db`. */
  path: string
  /** PRAGMA foreign_keys. Viewer = OFF (pull-only); admin = ON. */
  foreign_keys?: boolean
}

export interface OpenOpfsResult {
  connection: OpfsConnection
  /** True when the OPFS file had no `migrations` table yet (needs schema). */
  was_fresh: boolean
}

interface SqliteApi {
  vfs_register: (vfs: unknown, make_default?: boolean) => unknown
  open_v2: (name: string, flags?: number, vfs?: string) => Promise<number>
  exec: (db: number, sql: string) => Promise<unknown>
  execWithParams: (db: number, sql: string, params: SqliteParam[]) => Promise<{ columns: string[], rows: SqliteParam[][] }>
  run: (db: number, sql: string, params: SqliteParam[]) => Promise<unknown>
  close: (db: number) => Promise<unknown>
}

type SqliteParam = number | string | null | Uint8Array

const VFS_NAME = 'opfs-single-owner'

/**
 * ONE wasm instance + sqlite3 API per worker, with the VFS registered exactly
 * once on it. Memoized — NOT re-created per open: the VFS registration lives
 * on the wasm instance, so building a fresh instance per `open_opfs_connection`
 * call while remembering "already registered" in module state breaks every
 * SECOND open in a worker (self-heal retry, `reset()`) with an unknown-VFS
 * error.
 */
let sqlite3_promise: Promise<SqliteApi> | null = null

function get_sqlite3(): Promise<SqliteApi> {
  sqlite3_promise ??= (async () => {
    const { default: SQLiteESMFactory } = await import('wa-sqlite/dist/wa-sqlite-async.mjs')
    const SQLite = await import('wa-sqlite')

    // eslint-disable-next-line new-cap
    const module = await SQLiteESMFactory()
    // eslint-disable-next-line new-cap
    const sqlite3 = SQLite.Factory(module) as unknown as SqliteApi
    sqlite3.vfs_register(new OpfsSingleOwnerVFS(VFS_NAME) as unknown, false)
    return sqlite3
  })()
  return sqlite3_promise
}

export async function open_opfs_connection({ path, foreign_keys = false }: OpenOpfsOptions): Promise<OpenOpfsResult> {
  const sqlite3 = await get_sqlite3()

  const db = await sqlite3.open_v2(path, undefined, VFS_NAME)

  try {
    // cache_size first; then MEMORY journal (no on-disk -journal file → one OPFS
    // file, pure in-place writes). MEMORY matches the prior IndexedDB build's
    // behavior; crash-mid-write recovery is by re-sync (admin) / re-download
    // (viewer), so it's acceptable and maximizes the ~1x win.
    await sqlite3.exec(db, `PRAGMA cache_size = ${DB_CACHE_SIZE}`)
    await sqlite3.exec(db, 'PRAGMA journal_mode = MEMORY')
    await sqlite3.exec(db, `PRAGMA foreign_keys = ${foreign_keys ? 'ON' : 'OFF'}`)

    const existing = await sqlite3.execWithParams(
      db,
      `SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'`,
      [],
    )
    const was_fresh = existing.rows.length === 0

    return {
      connection: build_connection({ sqlite3, db }),
      was_fresh,
    }
  } catch (err) {
    // A corrupt/garbage file opens lazily but fails on the first statement
    // (SQLITE_NOTADB). Close the handle so the VFS releases its held SAH —
    // otherwise the file can never be deleted/reopened for self-heal recovery.
    try { await sqlite3.close(db) } catch { /* already broken */ }
    throw err
  }
}

function build_connection({ sqlite3, db }: { sqlite3: SqliteApi, db: number }): OpfsConnection {
  const serialize = create_mutex()
  return {
    is_persistent: true,
    query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      return serialize(async () => {
        const result = await sqlite3.execWithParams(db, sql, params as SqliteParam[])
        return result.rows.map((row) => {
          const obj: Record<string, unknown> = {}
          for (let i = 0; i < result.columns.length; i++) obj[result.columns[i]] = row[i]
          return obj
        }) as T[]
      })
    },
    execute(sql: string, params: unknown[] = []): Promise<void> {
      return serialize(async () => {
        if (params.length)
          await sqlite3.run(db, sql, params as SqliteParam[])
        else
          await sqlite3.exec(db, sql)
      })
    },
    exec_raw(sql: string): Promise<void> {
      return serialize(async () => { await sqlite3.exec(db, sql) })
    },
    async close(): Promise<void> {
      await serialize(async () => { await sqlite3.close(db) })
    },
  }
}

// ── raw OPFS file helpers (snapshot drop-in) ────────────────────────────────

interface OpfsPathParts {
  dirs: string[]
  filename: string
}

function opfs_path_parts(path: string): OpfsPathParts {
  const parts = path.split('/').filter(Boolean)
  const filename = parts.pop() ?? ''
  return { dirs: parts, filename }
}

async function resolve_opfs_dir(dirs: string[], { create }: { create: boolean }): Promise<FileSystemDirectoryHandle> {
  let handle = await navigator.storage.getDirectory()
  for (const dir of dirs)
    handle = await handle.getDirectoryHandle(dir, { create })
  return handle
}

/** Overwrite an OPFS file with `bytes`. The DB at `path` must NOT be open. */
export async function write_opfs_db_file({ path, bytes }: { path: string, bytes: Uint8Array }): Promise<void> {
  const { dirs, filename } = opfs_path_parts(path)
  const dir_handle = await resolve_opfs_dir(dirs, { create: true })
  const file_handle = await dir_handle.getFileHandle(filename, { create: true })
  const access_handle = await file_handle.createSyncAccessHandle()
  try {
    access_handle.truncate(0)
    access_handle.write(bytes, { at: 0 })
    access_handle.flush()
  } finally {
    access_handle.close()
  }
}

export async function opfs_file_exists({ path }: { path: string }): Promise<boolean> {
  const { dirs, filename } = opfs_path_parts(path)
  try {
    const dir_handle = await resolve_opfs_dir(dirs, { create: false })
    await dir_handle.getFileHandle(filename, { create: false })
    return true
  } catch {
    return false
  }
}

/** Delete an OPFS file. The DB at `path` must NOT be open. */
export async function delete_opfs_db_file({ path }: { path: string }): Promise<void> {
  const { dirs, filename } = opfs_path_parts(path)
  try {
    const dir_handle = await resolve_opfs_dir(dirs, { create: false })
    await dir_handle.removeEntry(filename)
  } catch { /* already gone */ }
}

function create_mutex() {
  let queue: Promise<unknown> = Promise.resolve()
  return function serialize<T>(fn: () => Promise<T>): Promise<T> {
    const next = queue.then(fn, fn)
    const noop = () => undefined
    queue = next.then(noop, noop)
    return next as Promise<T>
  }
}
