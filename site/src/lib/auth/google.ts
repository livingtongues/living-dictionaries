import { env as public_env } from '$env/dynamic/public'
import { createRemoteJWKSet, jwtVerify } from 'jose'

/**
 * Verify a Google ID token (the `credential` returned by GSI's
 * `CredentialResponse` on the client) against Google's JWKS endpoint.
 *
 * Implementation notes:
 *
 * 1. We use `$env/dynamic/public` (not `$env/static/public`) so the audience
 *    check reads the live process env at verify time. This lets the same
 *    server binary be used across dev / staging / prod with different OAuth
 *    clients without a rebuild — important since `PUBLIC_*` vars are
 *    otherwise inlined at build time.
 *
 * 2. Audience check is **required** — without it any token issued for any
 *    Google OAuth client (including one an attacker created in their own
 *    project) would verify. The audience binds the token to *our* client ID.
 *
 * 3. `email_verified` is enforced. Google's docs say it's almost always true
 *    for the `accounts.google.com` issuer, but we err on the side of refusing
 *    unverified emails because we use `email` as the cross-provider linking
 *    key in `find_or_create_auth_user`.
 *
 * 4. `createRemoteJWKSet` caches the JWKS in-process with a default 30s
 *    cooldown + 10m max age, so we don't hit Google on every login.
 */

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com']

export interface GoogleTokenPayload {
  sub: string
  email: string
  name: string
  picture?: string
}

export async function verify_google_id_token(id_token: string): Promise<GoogleTokenPayload> {
  const audience = public_env.PUBLIC_GOOGLE_OAUTH_CLIENT_ID
  if (!audience)
    throw new Error('PUBLIC_GOOGLE_OAUTH_CLIENT_ID environment variable is required')

  const { payload } = await jwtVerify(id_token, GOOGLE_JWKS, {
    issuer: GOOGLE_ISSUERS,
    audience,
  })

  if (payload.email_verified !== true)
    throw new Error('Google account email is not verified')

  const { sub, email, name, picture } = payload

  if (typeof sub !== 'string' || !sub)
    throw new Error('Google ID token missing sub')
  if (typeof email !== 'string' || !email)
    throw new Error('Google ID token missing email')

  return {
    sub,
    email,
    name: typeof name === 'string' ? name : '',
    picture: typeof picture === 'string' ? picture : undefined,
  }
}
