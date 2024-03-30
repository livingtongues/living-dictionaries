import { readable, writable } from 'svelte/store'
import type { LayoutData } from '../../routes/[dictionaryId]/$types'
import { type ActualDatabaseEntry, type IDictionary } from '@living-dictionaries/types'
import type { awaitableDocStore, collectionStore } from 'sveltefirets'
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
  entries: writable(null),
  status: writable(null),
  edited_entries: readable(null) as ReturnType<typeof collectionStore<ActualDatabaseEntry>>,
  update_index_entries: null,
  search_entries: null,
  default_entries_per_page: null,
  dbOperations: logDbOperations,
}
