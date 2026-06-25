import type { AdminMatchThreadToUserRequestBody, AdminMatchThreadToUserResponseBody } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_admin_match_thread_to_user(body: AdminMatchThreadToUserRequestBody) {
  return await post_request<AdminMatchThreadToUserRequestBody, AdminMatchThreadToUserResponseBody>(
    '/api/admin/match-thread-to-user',
    body,
  )
}
