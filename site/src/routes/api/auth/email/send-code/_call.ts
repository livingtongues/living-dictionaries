import type { AuthEmailSendCodeRequestBody, AuthEmailSendCodeResponseBody } from './+server.js'
import { post_request } from '$lib/utils/requests'

export async function api_auth_email_send_code(body: AuthEmailSendCodeRequestBody) {
  return await post_request<AuthEmailSendCodeRequestBody, AuthEmailSendCodeResponseBody>(
    '/api/auth/email/send-code',
    body,
  )
}
