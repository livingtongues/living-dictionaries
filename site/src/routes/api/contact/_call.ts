import type { ContactRequestBody, ContactResponseBody } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_contact(body: ContactRequestBody) {
  return await post_request<ContactRequestBody, ContactResponseBody>('/api/contact', body)
}
