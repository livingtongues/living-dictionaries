import type {
  DictionariesIdRolesGetResponseBody,
  DictionariesIdRolesPostRequestBody,
  DictionariesIdRolesPostResponseBody,
} from './+server'
import { get_request, post_request } from '$lib/utils/requests'

export async function api_dictionaries_id_roles_get(dict_id: string) {
  return await get_request<DictionariesIdRolesGetResponseBody>(`/api/dictionaries/${dict_id}/roles`)
}

export async function api_dictionaries_id_roles_post(dict_id: string, body: DictionariesIdRolesPostRequestBody) {
  return await post_request<DictionariesIdRolesPostRequestBody, DictionariesIdRolesPostResponseBody>(`/api/dictionaries/${dict_id}/roles`, body)
}
