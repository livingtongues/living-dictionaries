import { createQueryParamStore } from 'svelte-pieces'
import type { QueryParams } from '$lib/search/types'

export function load({ params: { dictionaryId } }) {
  const default_params: QueryParams = {
    page: 1,
    query: '',
  }
  const search_params = createQueryParamStore({
    key: 'q',
    startWith: default_params,
    storagePrefix: `${dictionaryId}_`,
    cleanFalseValues: true,
    // replaceState: false,
  })

  return {
    search_params,
  }
}
