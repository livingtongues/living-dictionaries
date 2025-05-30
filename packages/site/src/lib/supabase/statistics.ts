import { readable } from 'svelte/store'
import type { DictionaryView } from '@living-dictionaries/types'
import type { Supabase } from '.'
import { browser } from '$app/environment'
import { cached_query_data_store } from '$lib/supabase/cached-query-data'

export function create_dictionaries_store({ user_id, supabase }: { user_id: string, supabase: Supabase }) {
  if (!browser || !user_id) {
    return readable<DictionaryView[]>([])
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
