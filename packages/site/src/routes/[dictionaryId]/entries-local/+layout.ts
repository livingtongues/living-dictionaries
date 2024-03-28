import type { QueryParams } from '$lib/search/types';
import { createQueryParamStore } from 'svelte-pieces';

export const load = ({params: {dictionaryId}}) => {
  const default_params: QueryParams = {
    page: 1,
    query: '',
  }
  const search_params = createQueryParamStore({
    key: 'q',
    startWith: default_params,
    // persist: 'sessionStorage',
    storagePrefix: dictionaryId + '_',
    cleanFalseValues: true,
    // log: true
  })

  return { search_params }
}
