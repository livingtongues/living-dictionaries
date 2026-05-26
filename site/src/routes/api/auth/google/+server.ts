import type { AuthUserData } from '$lib/auth/types'
import type { RequestHandler } from './$types'
import { dev } from '$app/environment'
import { verify_google_id_token } from '$lib/auth/google'
import { EXPIRY_SECONDS, sign_jwt } from '$lib/auth/jwt'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { find_or_create_auth_user } from '$lib/server/find-or-create-auth-user'
import { get_user } from '$lib/server/get-user'
import { send_welcome_email } from '$lib/server/send-welcome-email'
import { error, json } from '@sveltejs/kit'

export interface AuthGoogleRequestBody {
  /** The `credential` field from a `CredentialResponse` returned by GSI. */
  id_token: string
}

export interface AuthGoogleResponseBody {
  user: AuthUserData
}

export const POST: RequestHandler = async ({ request, cookies }) => {
  const { id_token } = await request.json() as AuthGoogleRequestBody
  if (!id_token)
    error(ResponseCodes.BAD_REQUEST, 'id_token is required')

  let google_user: Awaited<ReturnType<typeof verify_google_id_token>>
  try {
    google_user = await verify_google_id_token(id_token)
  } catch {
    error(ResponseCodes.UNAUTHORIZED, 'Invalid Google ID token')
  }

  const db = get_shared_db()

  const { user, created } = find_or_create_auth_user({
    db,
    provider: 'google',
    provider_id: google_user.sub,
    trusted_email: google_user.email,
    new_user: {
      email: google_user.email,
      name: google_user.name || null,
      avatar_url: google_user.picture ?? null,
    },
  })

  // On every re-login, refresh email/name/avatar from the latest Google
  // profile (COALESCE keeps existing values if Google returned an empty).
  // First-login already wrote these via INSERT, so skip the no-op UPDATE.
  if (!created) {
    db.prepare(
      `UPDATE users
       SET email = COALESCE(?, email),
           name = COALESCE(?, name),
           avatar_url = COALESCE(?, avatar_url),
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?`,
    ).run(
      google_user.email,
      google_user.name || null,
      google_user.picture ?? null,
      user.id,
    )
  } else {
    // Fire-and-forget welcome email + admin notification on first sign-up.
    void send_welcome_email({ email: google_user.email, name: google_user.name || user.name }).catch((err) => {
      console.error('[auth/google] welcome email send failed:', err)
    })
  }

  const token = await sign_jwt({
    sub: user.id,
    email: google_user.email,
    name: google_user.name || user.name || undefined,
  })

  // Same cookie shape as email-verify so the SSR layer treats both providers
  // identically. See `routes/api/auth/email/verify/+server.ts` for the
  // attribute rationale (host-only, SameSite=Lax, Secure outside dev).
  cookies.set('session', token, {
    path: '/',
    httpOnly: true,
    secure: !dev,
    sameSite: 'lax',
    maxAge: EXPIRY_SECONDS,
  })

  const full_user = get_user({ db, user_id: user.id })
  if (!full_user)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, 'Failed to load user after sign-in')

  return json({ user: full_user } satisfies AuthGoogleResponseBody)
}
