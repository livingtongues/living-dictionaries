import type { ChatUsersResponse } from './+server'
import { get_request } from '$lib/utils/requests'

export async function api_chat_users({ query }: { query: string }) {
  return await get_request<ChatUsersResponse>(`/api/chat/users?q=${encodeURIComponent(query)}`)
}
