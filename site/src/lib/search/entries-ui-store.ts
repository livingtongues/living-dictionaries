import { get, writable } from 'svelte/store'
import type { Readable } from 'svelte/store'
import type { EntryData, Tables } from '$lib/types'
import type { DictConnection } from '$lib/db/dict-client/worker-connection'
import type { DictLiveDb } from '$lib/db/dict-client/dict-live-db.svelte'
import { init_entries, search_entries } from '$lib/search'
import { read_dict_bundle } from '$lib/search/read-dict-bundle'
import { create_orama_watcher } from '$lib/search/orama-watcher'
import type { OramaWatcher } from '$lib/search/orama-watcher'
import { decode_sqlite_code, is_transient_connection_error, sqlite_code_of } from '$lib/db/client/sqlite-result-codes'
import { snapshot_expired_recently } from '$lib/db/dict-client/snapshot-expired-tracker'
import { log_event } from '$lib/debug/remote-log'
import { browser } from '$app/environment'

interface OramaWatcherGlobals {
  __ld_orama_watchers?: Record<string, OramaWatcher>
}

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

  function set_entries_data(_entries_data: Record<string, EntryData>) {
    entries_data.set(_entries_data)
  }

  function upsert_entry_data(_entries_data: Record<string, EntryData>) {
    entries_data.update((e) => {
      return { ...e, ..._entries_data }
    })
  }

  function delete_entry(entry_id: string) {
    entries_data.update((e) => {
      const new_entries = { ...e }
      delete new_entries[entry_id]
      return new_entries
    })
  }

  function set_speakers(_speakers: Tables<'speakers'>[]) {
    speakers.set(_speakers)
  }

  function set_tags(_tags: Tables<'tags'>[]) {
    tags.set(_tags)
  }
  function set_dialects(_dialects: Tables<'dialects'>[]) {
    dialects.set(_dialects)
  }
  function set_sources(_sources: Tables<'sources'>[]) {
    sources.set(_sources)
  }

  function set_loading(_loading: boolean) {
    loading.set(_loading)
  }

  function mark_search_index_updated() {
    search_index_updated.set(true)
    search_index_updated.set(false)
  }

  const is_editor = get(can_edit)
  const is_admin = get(admin)

  if (browser && connection)
    void load_bundle_with_retry(connection)

  async function load_bundle_with_retry(conn: DictConnection, attempt = 0): Promise<void> {
    try {
      const bundle = await read_dict_bundle({ connection: conn })
      await init_entries({
        dictionary_id,
        can_edit: is_editor,
        admin: is_admin,
        bundle,
        set_entries_data,
        upsert_entry_data,
        delete_entry,
        set_speakers,
        set_tags,
        set_dialects,
        set_sources,
        set_loading,
        mark_search_index_updated,
      })

      // P4b: start the watch-based Orama feed once the bulk index is built.
      // Watermark = newest row already indexed; the watcher reindexes only
      // rows that change after it (local edits + remote pulls). init_entries
      // re-runs per navigation, so stop+replace any prior watcher for this
      // dict to avoid stacked subscribers.
      if (dict_db) {
        let watermark = ''
        for (const rows of Object.values(bundle)) {
          for (const row of rows) {
            const updated_at = String((row as { updated_at?: unknown }).updated_at ?? '')
            if (updated_at > watermark) watermark = updated_at
          }
        }
        const globals = globalThis as OramaWatcherGlobals
        globals.__ld_orama_watchers ??= {}
        globals.__ld_orama_watchers[dictionary_id]?.stop()
        globals.__ld_orama_watchers[dictionary_id] = create_orama_watcher({ connection: conn, dict_db, initial_watermark: watermark })
      }
    } catch (err) {
      // Retry ONCE on a torn-down-connection error: a concurrent
      // snapshot_expired reset closes the leader's OPFS connection mid-query
      // (SQLITE_MISUSE code 21), which would otherwise leave an EMPTY entry
      // list even though the snapshot holds every row (2026-07-04 P1). The
      // reset reopens in place, so a short retry lands on a live connection.
      if (attempt === 0 && is_transient_connection_error(err)) {
        await new Promise(resolve => setTimeout(resolve, 300))
        return load_bundle_with_retry(conn, attempt + 1)
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
      set_loading(false)
    }
  }

  return {
    subscribe: entries_data.subscribe,
    speakers,
    tags,
    dialects,
    sources,
    search_entries,
    loading,
    search_index_updated,
  }
}
