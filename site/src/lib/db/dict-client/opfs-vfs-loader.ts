import { DICT_DB_OPFS_PREFIX } from '$lib/constants'

/**
 * wa-sqlite bootstrap inside the SharedWorker.
 *
 * Opens (or creates) `dictionaries/{dict_id}.db` rooted in OPFS via
 * `OriginPrivateFileSystemVFS`. Pre-iOS-17 / unsupported browsers fall back
 * to `MemoryVFS` — these connections re-fetch every session (no persistence)
 * and the caller surfaces that to the user.
 *
 * The OPFS VFS reads/writes raw SQLite pages at fixed file offsets, so a .db
 * file pre-populated via the OPFS file API (before wa-sqlite is told to open
 * it) is readable as-is. That's how we drop in an R2/VPS snapshot.
 */

export interface DictSqliteConnection {
  query: <T>(sql: string, params?: unknown[]) => Promise<T[]>
  execute: (sql: string, params?: unknown[]) => Promise<void>
  exec_raw: (sql: string) => Promise<void>
  close: () => Promise<void>
  /** Drop the underlying OPFS file (no-op for MemoryVFS). */
  delete_file: () => Promise<void>
  /** True when the connection is backed by OPFS; false = MemoryVFS fallback. */
  is_opfs_backed: boolean
}

export interface OpenOptions {
  dict_id: string
  /**
   * Function the caller uses to write the snapshot bytes to OPFS BEFORE
   * SQLite opens the file. Called only when (a) the OPFS file doesn't exist
   * yet, OR (b) the caller forces a refetch (e.g. `snapshot_expired`).
   * Returns the raw .db bytes.
   */
  fetch_snapshot: () => Promise<Uint8Array>
  /** Force a fresh snapshot fetch even if the OPFS file already exists. */
  force_fresh?: boolean
}

export interface OpenResult {
  connection: DictSqliteConnection
  was_fresh_fetch: boolean
}

/** True if the runtime has OPFS + SyncAccessHandle (required by wa-sqlite). */
export async function opfs_is_available(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory)
      return false
    const root = await navigator.storage.getDirectory()
    // SyncAccessHandle is required by wa-sqlite's OPFS VFS. Probe by creating
    // a throwaway file and feature-detecting `createSyncAccessHandle`.
    const probe = await root.getFileHandle('.opfs-probe', { create: true })
    if (typeof (probe as { createSyncAccessHandle?: unknown }).createSyncAccessHandle !== 'function')
      return false
    try { await root.removeEntry('.opfs-probe') } catch { /* best-effort */ }
    return true
  } catch {
    return false
  }
}

function opfs_path_for(dict_id: string): string {
  return `${DICT_DB_OPFS_PREFIX}${dict_id}.db`
}

async function opfs_file_exists(dict_id: string): Promise<boolean> {
  try {
    const root = await navigator.storage.getDirectory()
    const dir = await root.getDirectoryHandle('dictionaries').catch(() => null)
    if (!dir)
      return false
    const file = await dir.getFileHandle(`${dict_id}.db`).catch(() => null)
    if (!file)
      return false
    const f = await file.getFile()
    return f.size > 0
  } catch {
    return false
  }
}

async function write_opfs_file({ dict_id, bytes }: { dict_id: string, bytes: Uint8Array }) {
  const root = await navigator.storage.getDirectory()
  const dir = await root.getDirectoryHandle('dictionaries', { create: true })
  const file = await dir.getFileHandle(`${dict_id}.db`, { create: true })
  const writable = await (file as { createWritable: () => Promise<FileSystemWritableFileStream> }).createWritable()
  // Underlying ArrayBufferView types vary across TS lib versions; `as
  // BufferSource` keeps both modern and older lib.dom.d.ts happy.
  await writable.write(bytes as unknown as BufferSource)
  await writable.close()
}

async function delete_opfs_file(dict_id: string) {
  try {
    const root = await navigator.storage.getDirectory()
    const dir = await root.getDirectoryHandle('dictionaries').catch(() => null)
    if (!dir)
      return
    await dir.removeEntry(`${dict_id}.db`).catch(() => { /* not there */ })
  } catch { /* best-effort */ }
}

/**
 * Open (or create) a wa-sqlite connection for a dict. Tries OPFS first; on
 * failure (no OPFS support / sync access handle missing), falls back to
 * MemoryVFS — in that case the caller's `fetch_snapshot` is invoked every
 * time the worker boots.
 */
export async function open_dict_connection(options: OpenOptions): Promise<OpenResult> {
  if (await opfs_is_available())
    return await open_opfs_connection(options)
  return await open_memory_connection(options)
}

async function open_opfs_connection(options: OpenOptions): Promise<OpenResult> {
  const { dict_id, fetch_snapshot, force_fresh } = options

  const need_fetch = force_fresh || !(await opfs_file_exists(dict_id))
  if (need_fetch) {
    const bytes = await fetch_snapshot()
    await write_opfs_file({ dict_id, bytes })
  }

  const sqlite3 = await load_wa_sqlite_async()
  const { OriginPrivateFileSystemVFS } = await import('wa-sqlite/src/examples/OriginPrivateFileSystemVFS.js') as {
    OriginPrivateFileSystemVFS: new () => unknown
  }
  // eslint-disable-next-line new-cap
  const vfs = new OriginPrivateFileSystemVFS() as { name: string }
  sqlite3.api.vfs_register(vfs)
  const db = await sqlite3.api.open_v2(opfs_path_for(dict_id), undefined, vfs.name)

  // Sensible PRAGMAs for a single-writer (SharedWorker is the only writer).
  // No WAL — OPFS VFS doesn't multi-write anyway; a rollback journal in the
  // same file is plenty.
  await sqlite3.api.exec(db, 'PRAGMA journal_mode = MEMORY')
  await sqlite3.api.exec(db, 'PRAGMA foreign_keys = ON')

  return {
    connection: build_connection({ sqlite3: sqlite3.api, db, dict_id, is_opfs_backed: true }),
    was_fresh_fetch: need_fetch,
  }
}

async function open_memory_connection(options: OpenOptions): Promise<OpenResult> {
  const { fetch_snapshot } = options

  // MemoryVFS can't load arbitrary bytes — but we can replay every page by
  // writing into a freshly-opened in-memory db via the deserialize technique?
  // wa-sqlite does NOT expose `sqlite3_deserialize`. So MemoryVFS fallback
  // can only run the migrations from scratch — no snapshot data — and the
  // sync engine pulls all rows via `/changes?since=null`. Acceptable for
  // pre-iOS-17 viewers (re-fetch every session per Story C).
  //
  // To at least HAVE the fetched bytes available for future use (and to
  // surface a real download to telemetry), we still call fetch_snapshot()
  // and discard the bytes — the cost is a single fetch on every boot.
  //
  // Editors on pre-iOS-17 are blocked by Story B.1 anyway (can't push
  // without persistent local state). The architecture doc accepts this.
  await fetch_snapshot().catch(() => { /* downloaded bytes intentionally discarded */ })

  const sqlite3 = await load_wa_sqlite_async()
  const { MemoryAsyncVFS } = await import('wa-sqlite/src/examples/MemoryAsyncVFS.js') as {
    MemoryAsyncVFS: new () => { name: string }
  }
  // eslint-disable-next-line new-cap
  const vfs = new MemoryAsyncVFS()
  sqlite3.api.vfs_register(vfs)
  const db = await sqlite3.api.open_v2(':memory:', undefined, vfs.name)
  await sqlite3.api.exec(db, 'PRAGMA journal_mode = MEMORY')
  await sqlite3.api.exec(db, 'PRAGMA foreign_keys = ON')

  return {
    connection: build_connection({ sqlite3: sqlite3.api, db, dict_id: options.dict_id, is_opfs_backed: false }),
    was_fresh_fetch: true,
  }
}

interface SqliteApi {
  vfs_register: (vfs: unknown) => unknown
  open_v2: (name: string, flags: number | undefined, vfs?: string) => Promise<number>
  exec: (db: number, sql: string) => Promise<unknown>
  execWithParams: (db: number, sql: string, params: (number | string | null | Uint8Array)[]) => Promise<{ columns: string[], rows: (number | string | null | Uint8Array)[][] }>
  run: (db: number, sql: string, params: (number | string | null | Uint8Array)[]) => Promise<unknown>
  close: (db: number) => Promise<unknown>
}

function build_connection({ sqlite3, db, dict_id, is_opfs_backed }: {
  sqlite3: SqliteApi
  db: number
  dict_id: string
  is_opfs_backed: boolean
}): DictSqliteConnection {
  const mutex = create_mutex()
  return {
    is_opfs_backed,
    query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      return mutex(async () => {
        const result = await sqlite3.execWithParams(db, sql, params as (number | string | null | Uint8Array)[])
        return result.rows.map((row) => {
          const obj: Record<string, unknown> = {}
          for (let i = 0; i < result.columns.length; i++) obj[result.columns[i]] = row[i]
          return obj
        }) as T[]
      })
    },
    execute(sql: string, params: unknown[] = []): Promise<void> {
      return mutex(async () => {
        if (params.length) {
          await sqlite3.run(db, sql, params as (number | string | null | Uint8Array)[])
        } else {
          await sqlite3.exec(db, sql)
        }
      })
    },
    exec_raw(sql: string): Promise<void> {
      return mutex(async () => { await sqlite3.exec(db, sql) })
    },
    async close(): Promise<void> {
      await sqlite3.close(db)
    },
    delete_file(): Promise<void> {
      return is_opfs_backed ? delete_opfs_file(dict_id) : Promise.resolve()
    },
  }
}

interface WaSqliteLoaded {
  api: SqliteApi
}

let wa_sqlite_promise: Promise<WaSqliteLoaded> | null = null

function load_wa_sqlite_async(): Promise<WaSqliteLoaded> {
  if (wa_sqlite_promise)
    return wa_sqlite_promise
  wa_sqlite_promise = (async () => {
    const { default: SQLiteESMFactory } = await import('wa-sqlite/dist/wa-sqlite-async.mjs')
    const SQLite = await import('wa-sqlite')
    // eslint-disable-next-line new-cap
    const module = await SQLiteESMFactory()
    // eslint-disable-next-line new-cap
    const api = SQLite.Factory(module) as unknown as SqliteApi
    return { api }
  })()
  return wa_sqlite_promise
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

/** Test/debug hook: drop the dict's OPFS file regardless of open state. */
export async function force_delete_opfs_file(dict_id: string): Promise<void> {
  await delete_opfs_file(dict_id)
}
