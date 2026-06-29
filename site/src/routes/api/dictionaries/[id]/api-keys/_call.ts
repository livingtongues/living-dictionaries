import type {
  DictionariesIdApiKeysGetResponseBody,
  DictionariesIdApiKeysPostRequestBody,
  DictionariesIdApiKeysPostResponseBody,
} from './+server'
import { get_request, post_request } from '$lib/utils/requests'

export async function api_list_api_keys(dictionary_id: string) {
  return await get_request<DictionariesIdApiKeysGetResponseBody>(`/api/dictionaries/${dictionary_id}/api-keys`)
}

export async function api_create_api_key(dictionary_id: string, body: DictionariesIdApiKeysPostRequestBody) {
  return await post_request<DictionariesIdApiKeysPostRequestBody, DictionariesIdApiKeysPostResponseBody>(`/api/dictionaries/${dictionary_id}/api-keys`, body)
}
