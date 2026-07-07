import { readable } from 'svelte/store'
import type { DictionaryView } from '$lib/types'
import type { LayoutData } from '../../routes/$types'
import type { LayoutData as DictionaryLayoutData } from '../../routes/[dictionaryId]/$types'
import { AuthUser } from '$lib/auth/user.svelte'
import { get_my_dictionary_roles } from '$lib/me/dictionary-roles.svelte'
import { log_db_operations } from './db'

// @ts-expect-error
export const mockAppLayoutData: LayoutData = {
  t: null,
  locale: null,
  auth_user: new AuthUser(),
  dict_roles: get_my_dictionary_roles(),
  ssr_user: null,
  my_dictionaries: readable([]),
  preferred_table_columns: null,
}

export const justMockDictionaryLayoutData = {
  dictionary: {
    name: 'test',
    gloss_languages: [],
  } as unknown as DictionaryView,
  speakers: null,
  is_manager: false,
  is_contributor: false,
  is_editor_or_above: false,
  can_edit: false,
  search_entries: null,
  default_entries_per_page: null,
  db_operations: log_db_operations,
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
