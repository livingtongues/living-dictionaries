import type { OpfsConnection } from './worker/opfs-connection'

/**
 * MemoryVFS fallback for runtimes without OPFS sync-access-handles (pre-iOS-17
 * Safari). No persistence: migrations run from scratch every boot and the sync
 * engine pulls all rows via `/changes?since=null`. Editors on these browsers
 * are blocked upstream (can't push without persistent local state).
 *
 * Returns the same structural shape as `open_opfs_connection`'s connection so
 * the dict instance treats both identically (`is_persistent: false` is what
 * marks the fallback).
 */

type SqliteParam = number | string | null | Uint8Array

interface SqliteApi {
  vfs_register: (vfs: unknown, make_default?: boolean) => unknown
  open_v2: (name: string, flags?: number, vfs?: string) => Promise<number>
  exec: (db: number, sql: string) => Promise<unknown>
  execWithParams: (db: number, sql: string, params: SqliteParam[]) => Promise<{ columns: string[], rows: SqliteParam[][] }>
  run: (db: number, sql: string, params: SqliteParam[]) => Promise<unknown>
  close: (db: number) => Promise<unknown>
}

export async function open_memory_connection({ foreign_keys = false }: { foreign_keys?: boolean } = {}): Promise<OpfsConnection> {
  const { default: SQLiteESMFactory } = await import('wa-sqlite/dist/wa-sqlite-async.mjs')
  const SQLite = await import('wa-sqlite')
  const { MemoryAsyncVFS } = await import('wa-sqlite/src/examples/MemoryAsyncVFS.js') as {
    MemoryAsyncVFS: new () => { name: string }
  }

  const module = await SQLiteESMFactory()

  const sqlite3 = SQLite.Factory(module) as unknown as SqliteApi

  const vfs = new MemoryAsyncVFS()
  sqlite3.vfs_register(vfs, false)
  const db = await sqlite3.open_v2(':memory:', undefined, vfs.name)

  await sqlite3.exec(db, 'PRAGMA journal_mode = MEMORY')
  await sqlite3.exec(db, `PRAGMA foreign_keys = ${foreign_keys ? 'ON' : 'OFF'}`)

  const serialize = create_mutex()
  return {
    is_persistent: false,
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

function create_mutex() {
  let queue: Promise<unknown> = Promise.resolve()
  return function serialize<T>(fn: () => Promise<T>): Promise<T> {
    const next = queue.then(fn, fn)
    const noop = () => undefined
    queue = next.then(noop, noop)
    return next as Promise<T>
  }
}
