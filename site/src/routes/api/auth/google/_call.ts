import type { AuthGoogleRequestBody, AuthGoogleResponseBody } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_auth_google(body: AuthGoogleRequestBody) {
  return await post_request<AuthGoogleRequestBody, AuthGoogleResponseBody>(
    '/api/auth/google',
    body,
  )
}
