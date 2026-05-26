/**
 * SQLite connection interface using wa-sqlite + IDBBatchAtomicVFS.
 * Used by `admin.db` (main thread). Dict.db uses a different connection on
 * top of OPFS VFS inside a SharedWorker — see Story B in
 * `.issues/port-db-sync-architecture.md`.
 *
 * Multi-tab supported via Web Locks coordination. IndexedDB stores 4KB pages.
 * Works in browsers, Android WebView, and iOS WKWebView.
 */
export interface SqliteConnection {
  query: <T>(sql: string, params?: unknown[]) => Promise<T[]>
  execute: (sql: string, params?: unknown[]) => Promise<void>
  exec_raw: (sql: string) => Promise<void>
  close: () => Promise<void>
  delete_db: () => Promise<void>
}

/**
 * Serializes async operations so only one runs at a time.
 * wa-sqlite's Asyncify build shares WASM memory across all calls,
 * so concurrent async operations corrupt state.
 */
function create_mutex() {
  let queue = Promise.resolve()
  return function serialize<T>(fn: () => Promise<T>): Promise<T> {
    const result = queue.then(fn, fn)
    const noop = () => undefined
    queue = result.then(noop, noop)
    return result
  }
}

export async function create_sqlite_connection(db_name: string): Promise<SqliteConnection> {
  const { default: SQLiteESMFactory } = await import('wa-sqlite/dist/wa-sqlite-async.mjs')
  const SQLite = await import('wa-sqlite')
  const { IDBBatchAtomicVFS } = await import('wa-sqlite/src/examples/IDBBatchAtomicVFS.js')

  // wa-sqlite exposes factory and constructor APIs that start with uppercase letters; suppress new-cap.
  // eslint-disable-next-line new-cap
  const module = await SQLiteESMFactory()
  // eslint-disable-next-line new-cap
  const sqlite3 = SQLite.Factory(module)

  const idb_name = `wa-sqlite-${db_name}`
  sqlite3.vfs_register(new IDBBatchAtomicVFS(idb_name))
  const db = await sqlite3.open_v2(db_name, undefined, idb_name)

  // cache_size must be set first — IDBBatchAtomicVFS uses batch atomic writes
  // where the journal stays in cache. If cache is too small, SQLite falls back
  // to external journal files which IDBBatchAtomicVFS can't handle.
  await sqlite3.exec(db, 'PRAGMA cache_size = -8192') // 8MB
  await sqlite3.exec(db, 'PRAGMA journal_mode = MEMORY')
  await sqlite3.exec(db, 'PRAGMA foreign_keys = ON')

  const serialize = create_mutex()

  request_persistent_storage()

  return {
    query<T>(sql: string, params?: unknown[]): Promise<T[]> {
      return serialize(async () => {
        const result = await sqlite3.execWithParams(db, sql, params as (number | string | null | Uint8Array)[])
        return result.rows.map((row) => {
          const obj: Record<string, unknown> = {}
          for (let i = 0; i < result.columns.length; i++) {
            obj[result.columns[i]] = row[i]
          }
          return obj
        }) as T[]
      })
    },

    execute(sql: string, params?: unknown[]): Promise<void> {
      return serialize(async () => {
        if (params?.length) {
          await sqlite3.run(db, sql, params as (number | string | null | Uint8Array)[])
        } else {
          await sqlite3.exec(db, sql)
        }
      })
    },

    exec_raw(sql: string): Promise<void> {
      return serialize(async () => {
        await sqlite3.exec(db, sql)
      })
    },

    async close(): Promise<void> {
      await sqlite3.close(db)
    },

    async delete_db(): Promise<void> {
      await sqlite3.close(db)
      const delete_request = indexedDB.deleteDatabase(idb_name)
      delete_request.onsuccess = () => {
        console.info(`Deleted database: ${idb_name}, reloading...`)
        location.reload()
      }
      delete_request.onerror = () => {
        console.error('Failed to delete database:', delete_request.error)
        location.reload()
      }
      delete_request.onblocked = () => {
        console.warn('Database deletion blocked, reloading anyway...')
        location.reload()
      }
      setTimeout(() => location.reload(), 5000)
    },
  }
}

/** Prevents iOS from evicting IndexedDB data under storage pressure */
function request_persistent_storage() {
  navigator.storage?.persist?.().then((granted) => {
    if (granted)
      console.info('Persistent storage granted')
  })
}
