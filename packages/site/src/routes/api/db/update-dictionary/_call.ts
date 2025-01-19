import type { TablesUpdate } from '@living-dictionaries/types'
import { authState } from 'sveltefirets'
import { get } from 'svelte/store'
import type { UpdateDictionaryRequestBody, UpdateDictionaryResponseBody } from './+server'
import { post_request } from '$lib/helpers/get-post-requests'

export async function api_update_dictionary(dictionary: TablesUpdate<'dictionaries'> & { id: string }) {
  const auth_state_user = get(authState)
  const auth_token = await auth_state_user.getIdToken()
  return await post_request<UpdateDictionaryRequestBody, UpdateDictionaryResponseBody>(`/api/db/update-dictionary`, { auth_token, dictionary })
}
