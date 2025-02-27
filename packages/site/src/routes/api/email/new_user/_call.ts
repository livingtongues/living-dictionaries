import type { NewUserEmailRequestBody } from './+server'
import { post_request } from '$lib/helpers/get-post-requests'

export async function api_email_new_user(body: NewUserEmailRequestBody) {
  return await post_request<NewUserEmailRequestBody, any>(`/api/email/new_user`, body)
}
