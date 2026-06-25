import type { AdminChatHeartbeatRequestBody } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_admin_chat_heartbeat(body: AdminChatHeartbeatRequestBody = {}) {
  // log_errors:false — background presence poll; transient redeploy network
  // failures must not spam logs (retries next interval). See /api/log.
  return await post_request<AdminChatHeartbeatRequestBody, { ok: true }>('/api/admin/chat/heartbeat', body, { log_errors: false })
}
