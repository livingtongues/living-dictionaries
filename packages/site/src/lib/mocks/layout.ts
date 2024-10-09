import { readable, writable } from 'svelte/store'
import type { ActualDatabaseEntry, IAbout, IDictionary, ISpeaker } from '@living-dictionaries/types'
import type { awaitableDocStore, collectionStore } from 'sveltefirets'
import type { LayoutData } from '../../routes/$types'
import type { LayoutData as DictionaryLayoutData } from '../../routes/[dictionaryId]/$types'
import { logDbOperations } from './db'

export const mockAppLayoutData: LayoutData = {
  t: null,
  locale: null,
  admin: readable(0),
  // supabase: null,
  // authResponse: null,
  user: readable(null),
  user_from_cookies: null,
  my_dictionaries: null,
  preferred_table_columns: null,
}

export const justMockDictionaryLayoutData = {
  dictionary: readable({
    name: 'test',
    glossLanguages: [],
  }) as Awaited<ReturnType<typeof awaitableDocStore<IDictionary>>>,
  speakers: readable<ISpeaker[]>([
    { displayName: 'Bob', id: '1' },
    { displayName: 'Bill', id: '2' },
  ]) as Awaited<ReturnType<typeof collectionStore<ISpeaker>>>,
  is_manager: readable(false),
  is_contributor: readable(false),
  can_edit: readable(false),
  entries: writable(null),
  status: writable(null),
  edited_entries: readable(null) as ReturnType<typeof collectionStore<ActualDatabaseEntry>>,
  update_index_entries: null,
  search_entries: null,
  default_entries_per_page: null,
  dbOperations: logDbOperations,
  load_citation: null,
  load_partners: null,
  about_content: readable(null) as Awaited<ReturnType<typeof awaitableDocStore<IAbout>>>,
  // about_content: readable({
  //   about: 'this is just a small example',
  // }) as Awaited<ReturnType<typeof awaitableDocStore<IAbout>>>,
} satisfies Partial<DictionaryLayoutData>

export const mockDictionaryLayoutData: DictionaryLayoutData = {
  ...mockAppLayoutData,
  ...justMockDictionaryLayoutData,
}
