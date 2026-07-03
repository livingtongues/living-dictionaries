import type { MessagesComposeRequestBody, MessagesComposeResponseBody } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_messages_compose(body: MessagesComposeRequestBody) {
  return await post_request<MessagesComposeRequestBody, MessagesComposeResponseBody>(
    '/api/messages/compose',
    body,
  )
}
