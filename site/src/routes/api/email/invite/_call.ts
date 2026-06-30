import type { InviteRequestBody } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_dictionary_invite(body: InviteRequestBody) {
  return await post_request<InviteRequestBody, any>(`/api/email/invite`, body)
}
