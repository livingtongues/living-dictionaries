import { get } from 'svelte/store'
import { authState } from 'sveltefirets'
import type { GCSServingUrlRequestBody, GCSServingUrlResponseBody } from './+server'
import { post_request } from '$lib/helpers/get-post-requests'

export async function api_gcs_serving_url(body: Omit<GCSServingUrlRequestBody, 'auth_token'>) {
  const auth_state_user = get(authState)
  const auth_token = await auth_state_user.getIdToken()

  return await post_request<GCSServingUrlRequestBody, GCSServingUrlResponseBody>(`/api/gcs_serving_url`, { ...body, auth_token })
}
