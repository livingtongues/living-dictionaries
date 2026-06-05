import type { DictionariesCreateRequestBody, DictionariesCreateResponseBody } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_dictionaries_create(body: DictionariesCreateRequestBody) {
  return await post_request<DictionariesCreateRequestBody, DictionariesCreateResponseBody>(
    `/api/dictionaries/create`,
    body,
  )
}
