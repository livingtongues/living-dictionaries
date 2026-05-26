import type { AuthLogoutResponseBody } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_auth_logout() {
  return await post_request<Record<string, never>, AuthLogoutResponseBody>('/api/auth/logout', {})
}
