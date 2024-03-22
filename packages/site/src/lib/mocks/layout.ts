import { readable, writable } from 'svelte/store'
import type { LayoutData } from '../../routes/[dictionaryId]/$types'
import { type IDictionary } from '@living-dictionaries/types'
import type { awaitableDocStore } from 'sveltefirets'
import { logDbOperations } from './db'

export const mockDictionaryLayoutData: LayoutData = {
  t: null,
  admin: readable(0),
  // supabase: null,
  // authResponse: null,
  user: readable(null),
  user_from_cookies: null,
  dictionary: readable({
    name: 'test',
    glossLanguages: []
  }) as Awaited<ReturnType<typeof awaitableDocStore<IDictionary>>>,
  speakers: null,
  is_manager: readable(false),
  is_contributor: readable(false),
  can_edit: readable(false),
  locale: null,
  my_dictionaries: null,
  preferred_table_columns: null,
  initial_entries: writable(null),
  search_entries: null,
  search_index_updated: writable(false),
  entries_per_page: null,
  dbOperations: logDbOperations,
}
