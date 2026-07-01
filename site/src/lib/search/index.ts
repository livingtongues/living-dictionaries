import { proxy } from 'comlink'
import type { EntryData, Tables } from '$lib/types'
import type { InitEntryWorkerOptions } from './entry.worker'
import type { SearchEntriesOptions } from './search-entries'

export async function search_entries(options: SearchEntriesOptions) {
  const { api } = await import('./expose-entry-worker')
  return api.search_entries(options)
}

export async function apply_rows(
  changes: Record<string, Record<string, unknown>[]>,
  deletes?: { table_name: string, id: string }[],
) {
  const { api } = await import('./expose-entry-worker')
  return api.apply_rows(changes, deletes)
}

export async function init_entries(options: InitEntryWorkerOptions) {
  const { dictionary_id, can_edit, admin, bundle } = options
  const { api } = await import('./expose-entry-worker')
  return api.init_entries(
    { dictionary_id, can_edit, admin },
    bundle,
    proxy(options.set_entries_data as (entries_data: Record<string, EntryData>) => Promise<void>),
    proxy(options.upsert_entry_data as (entries_data: Record<string, EntryData>) => Promise<void>),
    proxy(options.delete_entry as (entry_id: string) => Promise<void>),
    proxy(options.set_speakers as (speakers: Tables<'speakers'>[]) => Promise<void>),
    proxy(options.set_tags as (tags: Tables<'tags'>[]) => Promise<void>),
    proxy(options.set_dialects as (dialects: Tables<'dialects'>[]) => Promise<void>),
    proxy(options.set_sources as (sources: Tables<'sources'>[]) => Promise<void>),
    proxy(options.set_loading as (loading: boolean) => Promise<void>),
    proxy(options.mark_search_index_updated as () => Promise<void>),
  )
}
