import type { AdminSetNotifyChannelRequestBody, AdminSetNotifyChannelResponseBody } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_admin_set_notify_channel(body: AdminSetNotifyChannelRequestBody) {
  return await post_request<AdminSetNotifyChannelRequestBody, AdminSetNotifyChannelResponseBody>(
    '/api/admin/set-notify-channel',
    body,
  )
}
