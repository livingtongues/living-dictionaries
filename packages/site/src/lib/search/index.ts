import type { ExpandedEntry } from '@living-dictionaries/types';
import type { SearchEntriesOptions } from './orama.worker';

export async function create_index(entries: Map<string, ExpandedEntry>) {
  const { api } = await import('./expose-orama-worker')
  api.create_index(entries)
}

export async function search_entries(options: SearchEntriesOptions) {
  const { api } = await import('./expose-orama-worker')
  return api.search_entries(options)
}

export async function update_index_entries(entries: ExpandedEntry[]) {
  const { api } = await import('./expose-orama-worker')
  return api.update_index_entries(entries)
}

export async function update_index_entry(entry: ExpandedEntry) {
  const { api } = await import('./expose-orama-worker')
  return api.update_index_entry(entry)
}
