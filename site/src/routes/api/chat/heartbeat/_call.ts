import type { ChatHeartbeatRequestBody } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_chat_heartbeat(body: ChatHeartbeatRequestBody = {}) {
  // log_errors:false — background presence poll; transient redeploy network
  // failures must not spam logs (retries next interval). See /api/log.
  return await post_request<ChatHeartbeatRequestBody, { ok: true }>('/api/chat/heartbeat', body, { log_errors: false })
}
