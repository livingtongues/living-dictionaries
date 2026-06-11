import type { SqliteConnection } from '$lib/db/client/connection'
import type { DbClient } from './worker/db-client'
import type { DbEvent } from './worker/instance'

/**
 * Main-thread shim over the leader-worker `DbClient`. Implements the existing
 * `DictConnection` surface so `DictLiveDb`, the entries search feed, and the
 * dev `live-share` bridge keep working unchanged — every query/exec is an RPC
 * to whichever tab is leader (BroadcastChannel transport). `exec_raw` is
 * unsupported here: multi-statement SQL (migrations) runs inside the worker.
 */

export type BroadcastHandler = (broadcast: DbEvent) => void

export interface DictConnection extends SqliteConnection {
  /**
   * `execute` with optional broadcast hints. `affected_tables` overrides the
   * tables the worker tells other tabs to re-query (the SQL target may differ
   * from the tables that actually changed — e.g. a `deletes` tombstone fires a
   * trigger that DELETEs content rows). `deleted_rows` carries hard-deleted
   * `(table, id)` pairs so the worker re-broadcasts them as `rows_deleted` to
   * OTHER tabs' search indexes (a deleted row vanishes from their delta scan).
   */
  execute: (sql: string, params?: unknown[], options?: { affected_tables?: string[], deleted_rows?: { table_name: string, id: string }[] }) => Promise<void>
  /** Connection's dict_id. */
  readonly dict_id: string
  /** Subscribe to leader broadcasts for this dict (`tables_changed`, etc.). */
  subscribe_broadcasts: (handler: BroadcastHandler) => () => void
  /** Force a sync attempt (used by manual refresh / focus). */
  sync_now: () => Promise<void>
  /** OPFS-backed? (false = MemoryVFS fallback in the leader worker.) */
  readonly is_opfs_backed: boolean
}

export function create_dict_worker_connection({ client, dict_id }: { client: DbClient, dict_id: string }): DictConnection {
  return {
    dict_id,
    get is_opfs_backed(): boolean {
      return client.meta()?.persistent ?? false
    },

    query<T>(sql: string, params?: unknown[]): Promise<T[]> {
      return client.request<T[]>({ type: 'query', sql, params })
    },

    async execute(sql: string, params?: unknown[], options?: { affected_tables?: string[], deleted_rows?: { table_name: string, id: string }[] }): Promise<void> {
      // Heuristic: pull the affected table name from `UPDATE`/`INSERT`/`DELETE`
      // statements so the worker can broadcast a `tables_changed` event to
      // other tabs. Best-effort; over-broad notifications just trigger extra
      // re-queries on the other tabs (no correctness impact). Callers may pass
      // an explicit `affected_tables` override when the SQL target differs from
      // the tables that actually changed (e.g. a `deletes`-table trigger).
      const affected = options?.affected_tables ?? (() => {
        const table = extract_table_name(sql)
        return table ? [table] : undefined
      })()
      await client.request({ type: 'exec', sql, params, affected_tables: affected, deleted_rows: options?.deleted_rows })
    },

    exec_raw(_sql: string): Promise<void> {
      // exec_raw is for multi-statement SQL (e.g. migrations). For dict.db
      // those run inside the leader worker. Main-thread shouldn't need this.
      return Promise.reject(new Error('exec_raw is not supported on DictConnection — use migrations bundle inside the worker'))
    },

    async close(): Promise<void> {
      // The leader worker owns the DB lifecycle; nothing to close on the shim.
    },

    async delete_db(): Promise<void> {
      // Drop the OPFS file + refetch the snapshot from scratch.
      await client.request({ type: 'reset' }, { timeout_ms: 60_000 })
    },

    subscribe_broadcasts(handler: BroadcastHandler): () => void {
      return client.on_event(handler)
    },

    async sync_now(): Promise<void> {
      await client.request({ type: 'sync_now' }, { timeout_ms: 60_000 })
    },
  }
}

const TABLE_SQL_MATCH = /^\s*(?:INSERT\s+(?:OR\s+\w+\s+)?INTO|UPDATE|DELETE\s+FROM)\s+"?(\w+)"?/i

export function extract_table_name(sql: string): string | null {
  const match = sql.match(TABLE_SQL_MATCH)
  return match?.[1] ?? null
}

if (import.meta.vitest) {
  describe(extract_table_name, () => {
    test('extracts from INSERT INTO', () => {
      expect(extract_table_name(`INSERT INTO "entries" (id) VALUES (?)`)).toBe('entries')
    })
    test('extracts from INSERT OR REPLACE INTO', () => {
      expect(extract_table_name(`INSERT OR REPLACE INTO senses (id) VALUES (?)`)).toBe('senses')
    })
    test('extracts from UPDATE', () => {
      expect(extract_table_name(`UPDATE entries SET dirty = NULL WHERE id = ?`)).toBe('entries')
    })
    test('extracts from DELETE', () => {
      expect(extract_table_name(`DELETE FROM "deletes" WHERE id = ?`)).toBe('deletes')
    })
    test('returns null for SELECT', () => {
      expect(extract_table_name(`SELECT * FROM entries`)).toBeNull()
    })
  })
}
