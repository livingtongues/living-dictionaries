import type { MessagesContactRequestBody, MessagesContactResponseBody } from './+server'
import { post_request } from '$lib/utils/requests'

/**
 * Server-to-server-ish caller (same origin, so cookies flow). The internal
 * secret header is passed explicitly by the caller because public clients
 * shouldn't have it; only the contact-form server-action or the CF Worker
 * should call this endpoint.
 */
export async function api_messages_contact(body: MessagesContactRequestBody, { internal_secret }: { internal_secret: string }) {
  return await post_request<MessagesContactRequestBody, MessagesContactResponseBody>(
    '/api/messages/contact',
    body,
    { headers: { 'x-internal-secret': internal_secret } },
  )
}
