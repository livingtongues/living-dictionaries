import { createQueryParamStore } from '$lib/svelte-pieces'
import type { QueryParams } from '$lib/search/types'

export function load() {
  const default_params: QueryParams = {
    page: 1,
    query: '',
  }
  const search_params = createQueryParamStore({
    key: 'q',
    startWith: default_params,
    cleanFalseValues: true,
    // replaceState: false,
  })

  return {
    search_params,
  }
}
