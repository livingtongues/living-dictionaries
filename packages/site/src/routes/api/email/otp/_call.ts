import type { OTPEmailRequestBody, OTPEmailResponseBody } from './+server'
import { post_request } from '$lib/helpers/get-post-requests'

export async function api_email_otp(body: OTPEmailRequestBody) {
  return await post_request<OTPEmailRequestBody, OTPEmailResponseBody>(`/api/email/otp`, body)
}
