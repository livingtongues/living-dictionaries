import { get, writable } from 'svelte/store'
import type { Readable } from 'svelte/store'
import type { EntryData, Tables } from '$lib/types'
import type { DictConnection } from '$lib/db/dict-client/worker-connection'
import type { DictLiveDb } from '$lib/db/dict-client/dict-live-db.svelte'
import { init_entries, reset_caches, search_entries } from '$lib/search'
import { read_dict_bundle } from '$lib/search/read-dict-bundle'
import { create_orama_watcher } from '$lib/search/orama-watcher'
import type { OramaWatcher } from '$lib/search/orama-watcher'
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

  function set_loading(_loading: boolean) {
    loading.set(_loading)
  }

  function mark_search_index_updated() {
    search_index_updated.set(true)
    search_index_updated.set(false)
  }

  const is_editor = get(can_edit)
  const is_admin = get(admin)

  if (browser && connection) {
    read_dict_bundle({ connection })
      .then(async (bundle) => {
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
          globals.__ld_orama_watchers[dictionary_id] = create_orama_watcher({ connection, dict_db, initial_watermark: watermark })
        }
      })
      .catch((err) => {
        console.error('Failed to read dict bundle from wa-sqlite', err)
        set_loading(false)
      })
  }

  return {
    subscribe: entries_data.subscribe,
    speakers,
    tags,
    dialects,
    reset_caches,
    search_entries,
    loading,
    search_index_updated,
  }
}
