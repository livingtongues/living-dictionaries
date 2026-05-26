import type { AuthMeResponseBody } from './+server.js'
import { get_request } from '$lib/utils/requests'

export async function api_auth_me() {
  return await get_request<AuthMeResponseBody>('/api/auth/me')
}
