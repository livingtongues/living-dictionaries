import type { ChatMessagesResponse } from './+server'
import { get_request } from '$lib/utils/requests'

export async function api_chat_messages({ room_id, after }: { room_id: string, after?: string | null }) {
  const params = new URLSearchParams({ room_id })
  if (after)
    params.set('after', after)
  // log_errors:false — background message poll; transient redeploy network
  // failures must not spam logs (retries next interval). See /api/log.
  return await get_request<ChatMessagesResponse>(`/api/chat/messages?${params.toString()}`, { log_errors: false })
}
