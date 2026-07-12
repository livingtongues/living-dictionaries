import { get, writable } from 'svelte/store'
import type { Readable } from 'svelte/store'
import type { EntryData, Tables } from '$lib/types'
import type { DictConnection } from '$lib/db/dict-client/worker-connection'
import type { DictLiveDb } from '$lib/db/dict-client/dict-live-db.svelte'
import { init_entries, search_entries, search_sentences, search_texts } from '$lib/search'
import { create_patch_reducer } from '$lib/search/worker-patch'
import { read_dict_bundle } from '$lib/search/read-dict-bundle'
import { create_orama_watcher } from '$lib/search/orama-watcher'
import { decode_sqlite_code, is_transient_connection_error, sqlite_code_of } from '$lib/db/client/sqlite-result-codes'
import { snapshot_expired_recently } from '$lib/db/dict-client/snapshot-expired-tracker'
import { replace_orama_watcher } from '$lib/db/dict-client/dict-session'
import { log_event } from '$lib/debug/remote-log'
import { browser } from '$app/environment'

export function create_entries_ui_store({
  dictionary_id,
  can_edit,
  admin,
  connection,
  dict_db,
}: {
  dictionary_id: string
  can_edit: Readable<boolean>
  admin: Readable<number>
  connection: DictConnection | null
  dict_db: DictLiveDb | null
}) {
  const entries_data = writable<Record<string, EntryData>>({})
  const speakers = writable<Tables<'speakers'>[]>([])
  const tags = writable<Tables<'tags'>[]>([])
  const dialects = writable<Tables<'dialects'>[]>([])
  const sources = writable<Tables<'sources'>[]>([])
  const search_index_updated = writable(false)
  const loading = writable(true)

  // Every worker→store state transition lives in the reducer (worker-patch.ts).
  const apply_patch = create_patch_reducer({ entries_data, speakers, tags, dialects, sources, loading, search_index_updated })

  const is_editor = get(can_edit)
  const is_admin = get(admin)

  if (browser && connection)
    void load_bundle_with_retry(connection)

  async function load_bundle_with_retry(conn: DictConnection, attempt = 0, boot_attempt = 0): Promise<void> {
    try {
      const bundle = await read_dict_bundle({ connection: conn })
      await init_entries({
        dictionary_id,
        can_edit: is_editor,
        admin: is_admin,
        bundle,
        on_patch: apply_patch,
      })

      // P4b: start the watch-based Orama feed once the bulk index is built.
      // Watermark = newest row already indexed; the watcher reindexes only
      // rows that change after it (local edits + remote pulls). init_entries
      // re-runs per navigation, so the dict-session registry stops+replaces
      // any prior watcher for this dict to avoid stacked subscribers.
      if (dict_db) {
        let watermark = ''
        for (const rows of Object.values(bundle)) {
          for (const row of rows) {
            const updated_at = String((row as { updated_at?: unknown }).updated_at ?? '')
            if (updated_at > watermark) watermark = updated_at
          }
        }
        replace_orama_watcher({ dict_id: dictionary_id, make: () => create_orama_watcher({ connection: conn, dict_db, initial_watermark: watermark }) })
      }
    } catch (err) {
      // Cold-boot wait-out: the dict `+layout.ts` now returns before the leader
      // worker is ready (non-blocking boot), so this first bundle read can fire
      // while the snapshot is still downloading — the queued RPC times out after
      // the transport's 20s window (`code === 'timeout'`). Retry with backoff on
      // its own budget: once the leader is ready the read returns immediately, so
      // this only spins on genuinely slow boots (big dict + poor connection).
      // Without it a >20s boot would leave the Orama list empty.
      if ((err as { code?: string } | null)?.code === 'timeout' && boot_attempt < 6) {
        await new Promise(resolve => setTimeout(resolve, Math.min(1000 * 2 ** boot_attempt, 8000)))
        return load_bundle_with_retry(conn, attempt, boot_attempt + 1)
      }

      // Retry on a torn-down-connection error: a concurrent snapshot_expired
      // reset closes the leader's OPFS connection mid-query (SQLITE_MISUSE
      // code 21), which would otherwise leave an EMPTY entry list even though
      // the snapshot holds every row (2026-07-04 P1). The reset reopens in
      // place, so a short retry usually lands on a live connection.
      //
      // A `snapshot_expired` reset is heavier than a normal reconnect (it
      // deletes the OPFS file, refetches the snapshot over the network, then
      // reopens) — a single fixed 300ms retry sometimes wasn't enough and
      // still failed a second time (2 confirmed post-fix instances,
      // 2026-07-05: `kharia`, `apatani`, both `retried:true` yet still
      // MISUSE). When we know a snapshot_expired reset is/was in flight for
      // this dict, allow a second, longer retry.
      const max_attempts = snapshot_expired_recently(dictionary_id) ? 2 : 1
      if (attempt < max_attempts && is_transient_connection_error(err)) {
        await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)))
        return load_bundle_with_retry(conn, attempt + 1, boot_attempt)
      }
      const code = sqlite_code_of(err)
      log_event({
        level: 'error',
        message: 'Failed to read dict bundle from wa-sqlite',
        context: {
          dict_id: dictionary_id,
          sqlite_code: code,
          sqlite_code_name: decode_sqlite_code(code),
          snapshot_expired_recently: snapshot_expired_recently(dictionary_id),
          retried: attempt > 0,
        },
      })
      loading.set(false)
    }
  }

  return {
    subscribe: entries_data.subscribe,
    speakers,
    tags,
    dialects,
    sources,
    search_entries,
    search_sentences,
    search_texts,
    loading,
    search_index_updated,
  }
}
