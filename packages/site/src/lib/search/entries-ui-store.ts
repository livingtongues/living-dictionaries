import { type Readable, get, writable } from 'svelte/store'
import type { EntryData, Tables } from '@living-dictionaries/types'
import { init_entries, reset_caches, search_entries } from '$lib/search'
import { browser } from '$app/environment'
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_API_URL } from '$env/static/public'

export function create_entries_ui_store({
  dictionary_id,
  can_edit,
  admin,
}: {
  dictionary_id: string
  can_edit: Readable<boolean>
  admin: Readable<number>
}) {
  const entries_data = writable<Record<string, EntryData>>({})
  const speakers = writable<Tables<'speakers'>[]>([])
  const tags = writable<Tables<'tags'>[]>([])
  const dialects = writable<Tables<'dialects'>[]>([])
  const search_index_updated = writable(false)
  const loading = writable(true)

  function set_entries_data(_entries_data: Record<string, EntryData>) {
    entries_data.set(_entries_data)
    console.info({ _entries_data })
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
    console.info({ _speakers })
  }

  function set_tags(_tags: Tables<'tags'>[]) {
    tags.set(_tags)
    console.info({ _tags })
  }
  function set_dialects(_dialects: Tables<'dialects'>[]) {
    dialects.set(_dialects)
    console.info({ _dialects })
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

  if (browser) {
    init_entries({
      dictionary_id,
      can_edit: is_editor,
      admin: is_admin,
      PUBLIC_SUPABASE_ANON_KEY,
      PUBLIC_SUPABASE_API_URL,
      set_entries_data,
      upsert_entry_data,
      delete_entry,
      set_speakers,
      set_tags,
      set_dialects,
      set_loading,
      mark_search_index_updated,
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
