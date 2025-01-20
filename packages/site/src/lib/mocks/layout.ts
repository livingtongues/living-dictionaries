import { readable } from 'svelte/store'
import type { DictionaryView } from '@living-dictionaries/types'
import type { LayoutData } from '../../routes/$types'
import type { LayoutData as DictionaryLayoutData } from '../../routes/[dictionaryId]/$types'
import { logDbOperations } from './db'

export const mockAppLayoutData: LayoutData = {
  t: null,
  locale: null,
  admin: readable(0),
  supabase: null,
  // authResponse: null,
  user: readable(null),
  user_from_cookies: null,
  preferred_table_columns: null,
}

export const justMockDictionaryLayoutData = {
  // @ts-expect-error
  dictionary: {
    name: 'test',
    gloss_languages: [],
  } as DictionaryView,
  speakers: null,
  is_manager: readable(false),
  is_contributor: readable(false),
  can_edit: readable(false),
  entries: null,
  search_entries: null,
  default_entries_per_page: null,
  dbOperations: logDbOperations,
  load_citation: null,
  load_partners: null,
  // about_content: readable(null) as Awaited<ReturnType<typeof awaitableDocStore<IAbout>>>,
  // about_content: readable({
  //   about: 'this is just a small example',
  // }) as Awaited<ReturnType<typeof awaitableDocStore<IAbout>>>,
} satisfies Partial<DictionaryLayoutData>

// @ts-expect-error
export const mockDictionaryLayoutData: DictionaryLayoutData = {
  ...mockAppLayoutData,
  ...justMockDictionaryLayoutData,
}
