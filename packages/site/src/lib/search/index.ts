import type { ExpandedEntry } from '@living-dictionaries/types';
import type { QueryParams } from './types';

export async function create_index(entries: ExpandedEntry[]) {
  const { api } = await import('./expose-orama-worker')
  api.create_index(entries)
}

export async function search_entries(query_params: QueryParams, page_index: number, entries_per_page: number) {
  const { api } = await import('./expose-orama-worker')
  return api.search_entries(query_params, page_index, entries_per_page)
}
