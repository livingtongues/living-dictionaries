import type { DictionaryView } from '@living-dictionaries/types'
import type { PageLoad } from './$types'
import { cached_query_data_store } from '$lib/supabase/cached-query-data'

export const load = (async ({ parent }) => {
  const { supabase } = await parent()

  const dictionaries = cached_query_data_store<DictionaryView>({
    materialized_query: supabase.from('materialized_dictionaries_view')
      .select(),
    live_query: supabase.from('dictionaries_view')
      .select(),
    key: 'public_dictionaries_list',
  })

  return { dictionaries }
}) satisfies PageLoad
