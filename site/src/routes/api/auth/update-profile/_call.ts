import type { AuthUpdateProfileRequestBody, AuthUpdateProfileResponseBody } from './+server.js'
import { post_request } from '$lib/utils/requests'

export async function api_auth_update_profile(body: AuthUpdateProfileRequestBody) {
  return await post_request<AuthUpdateProfileRequestBody, AuthUpdateProfileResponseBody>(
    '/api/auth/update-profile',
    body,
  )
}
