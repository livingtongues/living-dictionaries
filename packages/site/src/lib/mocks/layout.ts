import { readable } from 'svelte/store'
import type { LayoutData } from '../../routes/[dictionaryId]/$types'
import type { IDictionary } from '@living-dictionaries/types'
import type { docStore } from 'sveltefirets'

export const mockDictionaryLayoutData: LayoutData = {
  t: null,
  admin: readable(0),
  // supabase: null,
  // authResponse: null,
  user: readable(null),
  dictionary: readable({
    name: 'test',
    glossLanguages: []
  }) as ReturnType<typeof docStore<IDictionary>>,
  is_manager: readable(false),
  is_contributor: readable(false),
  can_edit: readable(false),
  locale: null,
  my_dictionaries: null,
  preferred_table_columns: null,
  entries: null,
  entries_per_page: null,
}
