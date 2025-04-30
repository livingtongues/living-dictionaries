import type { SearchEntriesOptions } from './search-entries'
import type { EntryData } from './types'

export async function create_index(entries: EntryData[], dictionary_id: string) {
  const { api } = await import('./expose-orama-worker')
  api.create_index(entries, dictionary_id)
}

export async function search_entries(options: SearchEntriesOptions) {
  const { api } = await import('./expose-orama-worker')
  return api.search_entries(options)
}

// export async function update_index_entries(entries: EntryData[]) {
//   const { api } = await import('./expose-orama-worker')
//   return api.update_index_entries(entries)
// }

export async function update_index_entry(entry: EntryData, dictionary_id: string) {
  const { api } = await import('./expose-orama-worker')
  return api.update_index_entry(entry, dictionary_id)
}

export async function load_cached_index(dictionary_id: string) {
  const { api } = await import('./expose-orama-worker')
  return api.load_cached_index(dictionary_id)
}
