import { get } from 'svelte/store'
import { authState } from 'sveltefirets'
import type { UploadRequestBody, UploadResponseBody } from './+server'
import { post_request } from '$lib/helpers/get-post-requests'

export async function api_upload(body: Omit<UploadRequestBody, 'auth_token'>) {
  const auth_state_user = get(authState)
  const auth_token = await auth_state_user.getIdToken()
  return await post_request<UploadRequestBody, UploadResponseBody>(`/api/upload`, { ...body, auth_token })
}
