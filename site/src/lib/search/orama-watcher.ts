import type { DictLiveDb } from '$lib/db/dict-client/dict-live-db.svelte'
import { parse_dict_row } from '$lib/db/schemas/dictionary-json-columns'
import { apply_rows } from '$lib/search'
import { WATCHED_TABLES } from './read-dict-bundle'

/**
 * vps-migration M4 write/sync P4b — the watch-based Orama feed.
 *
 * Orama watches wa-sqlite: ONE path that covers local edits AND remote
 * sync-pulls. `dict_db.subscribe(table, cb)` fires on both (local writes call
 * the notifier directly; remote pulls arrive as a SharedWorker `tables_changed`
 * broadcast that DictLiveDbImpl fans into the same notifier). On any change we
 * debounce, query wa-sqlite for rows changed since a watermark (incl. soft-
 * deletes), and hand them to the worker's `apply_rows`, which re-assembles +
 * reindexes only the affected entries. This replaces the prior interim `api.X`
 * double-write in operations.ts.
 */

interface QueryableConnection {
  query: <T>(sql: string, params?: unknown[]) => Promise<T[]>
}

export interface OramaWatcher {
  stop: () => void
}

const DEBOUNCE_MS = 40

export function create_orama_watcher({ connection, dict_db, initial_watermark }: {
  connection: QueryableConnection
  dict_db: DictLiveDb
  initial_watermark: string
}): OramaWatcher {
  let watermark = initial_watermark
  let scanning = false
  let rescan_requested = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let stopped = false
  // Hard-deletes vanish from the `updated_at` delta scan, so they arrive
  // out-of-band via `dict_db.subscribe_deletes` (local writes + sync pulls) and
  // queue here until the next scan hands them to the worker.
  let pending_deletes: { table_name: string, id: string }[] = []

  async function scan() {
    if (scanning) {
      rescan_requested = true
      return
    }
    scanning = true
    try {
      const changes: Record<string, Record<string, unknown>[]> = {}
      let max_seen = watermark
      for (const table of WATCHED_TABLES) {
        const rows = await connection.query<Record<string, unknown>>(
          `SELECT * FROM "${table}" WHERE updated_at > ? ORDER BY updated_at ASC`,
          [watermark],
        )
        if (!rows.length) continue
        for (const row of rows) {
          parse_dict_row(table, row)
          const updated_at = String(row.updated_at ?? '')
          if (updated_at > max_seen) max_seen = updated_at
        }
        changes[table] = rows
      }
      const deletes = pending_deletes
      pending_deletes = []
      if (Object.keys(changes).length || deletes.length) {
        await apply_rows(changes, deletes.length ? deletes : undefined)
        watermark = max_seen
      }
    } catch (err) {
      console.error('[orama-watcher] delta scan failed', err)
    } finally {
      scanning = false
      if (rescan_requested && !stopped) {
        rescan_requested = false
        void scan()
      }
    }
  }

  function trigger() {
    if (timer || stopped) return
    timer = setTimeout(() => {
      timer = null
      void scan()
    }, DEBOUNCE_MS)
  }

  const unsubscribers = WATCHED_TABLES.map(table => dict_db.subscribe(table, trigger))
  unsubscribers.push(dict_db.subscribe_deletes((events) => {
    pending_deletes.push(...events)
    trigger()
  }))

  // Catch anything written/pulled between the init-bundle read and this subscribe.
  void scan()

  return {
    stop() {
      stopped = true
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      for (const unsubscribe of unsubscribers) unsubscribe()
    },
  }
}
