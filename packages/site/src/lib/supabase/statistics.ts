import { writable } from 'svelte/store'
import type { DictionaryView } from '@living-dictionaries/types'
import type { Supabase } from '.'
import { browser } from '$app/environment'
import { cached_query_data_store } from '$lib/supabase/cached-query-data'

export function create_dictionaries_store({ supabase }: { supabase: Supabase }) {
  if (!browser) {
    return writable<DictionaryView[]>([])
  }
  const dictionaries = cached_query_data_store<DictionaryView>({
    materialized_query: supabase.from('materialized_admin_dictionaries_view')
      .select(),
    live_query: supabase.from('dictionaries_view')
      .select(),
    key: 'dictionaries',
  })

  return dictionaries
}
