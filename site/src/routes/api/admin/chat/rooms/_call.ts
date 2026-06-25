import type { AdminChatRoomsResponse } from './+server'
import { get_request } from '$lib/utils/requests'

export async function api_admin_chat_rooms() {
  // log_errors:false — this is a background poll; a transient network failure
  // during a Docker redeploy must not spam the console / re-ship as a log row
  // (the poll retries on its next interval). Mirrors /api/log's suppression.
  return await get_request<AdminChatRoomsResponse>('/api/admin/chat/rooms', { log_errors: false })
}
