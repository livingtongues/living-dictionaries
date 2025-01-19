import { authState } from 'sveltefirets'
import { get } from 'svelte/store'
import type { CreateDictionaryRequestBody } from './+server'
import { post_request } from '$lib/helpers/get-post-requests'

export async function api_create_dictionary(body: Omit<CreateDictionaryRequestBody, 'auth_token'>) {
  const auth_state_user = get(authState)
  const auth_token = await auth_state_user.getIdToken()
  return await post_request<CreateDictionaryRequestBody, null>(`/api/db/create-dictionary`, { ...body, auth_token })
}
