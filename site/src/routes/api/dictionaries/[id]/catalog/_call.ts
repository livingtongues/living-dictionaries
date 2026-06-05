import type { DictionariesCatalogRequestBody, DictionariesCatalogResponseBody } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_dictionaries_catalog(dict_id: string, body: DictionariesCatalogRequestBody) {
  return await post_request<DictionariesCatalogRequestBody, DictionariesCatalogResponseBody>(
    `/api/dictionaries/${dict_id}/catalog`,
    body,
  )
}
