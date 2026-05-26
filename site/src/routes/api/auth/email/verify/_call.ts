import type { AuthEmailVerifyRequestBody, AuthEmailVerifyResponseBody } from './+server.js'
import { post_request } from '$lib/utils/requests'

export async function api_auth_email_verify(body: AuthEmailVerifyRequestBody) {
  return await post_request<AuthEmailVerifyRequestBody, AuthEmailVerifyResponseBody>(
    '/api/auth/email/verify',
    body,
  )
}
