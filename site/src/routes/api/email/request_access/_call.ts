import type { RequestAccessBody } from './+server'
import { post_request } from '$lib/helpers/get-post-requests'

export async function api_request_access(body: RequestAccessBody) {
  return await post_request<RequestAccessBody, any>(`/api/email/request_access`, body)
}
