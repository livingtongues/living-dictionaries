import type { MyDictionaryRolesResponseBody } from './+server'
import { get_request } from '$lib/utils/requests'

export async function api_me_dictionary_roles() {
  return await get_request<MyDictionaryRolesResponseBody>('/api/me/dictionary-roles')
}
