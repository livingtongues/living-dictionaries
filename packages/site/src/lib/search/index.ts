import { proxy } from 'comlink'
import type { EntryData, Tables } from '@living-dictionaries/types'
import type { InitEntryWorkerOptions } from './entry.worker'
import type { SearchEntriesOptions } from './search-entries'

export async function search_entries(options: SearchEntriesOptions) {
  const { api } = await import('./expose-entry-worker')
  return api.search_entries(options)
}

export async function reset_caches() {
  const { api } = await import('./expose-entry-worker')
  return api.reset_caches()
}

export async function init_entries(options: InitEntryWorkerOptions) {
  const { dictionary_id, can_edit, admin, PUBLIC_SUPABASE_API_URL, PUBLIC_SUPABASE_ANON_KEY } = options
  const { api } = await import('./expose-entry-worker')
  return api.init_entries(
    { dictionary_id, can_edit, admin, PUBLIC_SUPABASE_API_URL, PUBLIC_SUPABASE_ANON_KEY },
    proxy(options.set_entries_data as (entries_data: Record<string, EntryData>) => Promise<void>),
    proxy(options.upsert_entry_data as (entries_data: Record<string, EntryData>) => Promise<void>),
    proxy(options.delete_entry as (entry_id: string) => Promise<void>),
    proxy(options.set_speakers as (speakers: Tables<'speakers'>[]) => Promise<void>),
    proxy(options.set_tags as (tags: Tables<'tags'>[]) => Promise<void>),
    proxy(options.set_dialects as (dialects: Tables<'dialects'>[]) => Promise<void>),
    proxy(options.set_loading as (loading: boolean) => Promise<void>),
    proxy(options.mark_search_index_updated as () => Promise<void>),
  )
}
