import type { AuthUserData } from '$lib/auth/types'
import type { RequestHandler } from './$types'
import { dev } from '$app/environment'
import { EXPIRY_SECONDS, sign_jwt } from '$lib/auth/jwt'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { find_or_create_auth_user } from '$lib/server/find-or-create-auth-user'
import { get_user } from '$lib/server/get-user'
import { send_welcome_email } from '$lib/server/send-welcome-email'
import { error, json } from '@sveltejs/kit'

export interface AuthEmailVerifyRequestBody {
  email: string
  code: string
}

export interface AuthEmailVerifyResponseBody {
  user: AuthUserData
}

const MAX_ATTEMPTS_PER_WINDOW = 5
const WINDOW_MS = 15 * 60 * 1000

interface EmailCodeRow {
  rowid: number
  email: string
  code: string
  expires_at: string
  created_at: string
}

/**
 * In-memory rolling counter of failed verify attempts per email. Resets on
 * server restart (acceptable — send-code already caps at 10/hour so attack
 * surface is bounded). For multi-process deployments this would need Redis or
 * a DB table, but the current stack is single-process per VPS.
 */
const failed_attempts = new Map<string, number[]>()

function track_failed_attempt(email: string): number {
  const now = Date.now()
  const window_start = now - WINDOW_MS
  const history = (failed_attempts.get(email) ?? []).filter(t => t >= window_start)
  history.push(now)
  failed_attempts.set(email, history)
  return history.length
}

function current_failed_count(email: string): number {
  const now = Date.now()
  const window_start = now - WINDOW_MS
  const history = (failed_attempts.get(email) ?? []).filter(t => t >= window_start)
  failed_attempts.set(email, history)
  return history.length
}

function clear_failed_attempts(email: string) {
  failed_attempts.delete(email)
}

export const POST: RequestHandler = async ({ request, cookies }) => {
  const { email: raw_email, code } = await request.json() as AuthEmailVerifyRequestBody
  if (!raw_email || !code)
    error(ResponseCodes.BAD_REQUEST, 'Email and code are required')

  const email = raw_email.trim().toLowerCase()

  if (current_failed_count(email) >= MAX_ATTEMPTS_PER_WINDOW)
    error(ResponseCodes.TOO_MANY_REQUESTS, 'Too many verification attempts. Please request a new code.')

  const db = get_shared_db()

  const email_code = db.prepare(
    'SELECT rowid, * FROM email_codes WHERE email = ? AND code = ? ORDER BY created_at DESC LIMIT 1',
  ).get(email, code) as EmailCodeRow | undefined

  if (!email_code) {
    track_failed_attempt(email)
    error(ResponseCodes.UNAUTHORIZED, 'Invalid code')
  }

  if (new Date(email_code.expires_at) < new Date()) {
    db.prepare('DELETE FROM email_codes WHERE rowid = ?').run(email_code.rowid)
    error(ResponseCodes.UNAUTHORIZED, 'Code has expired')
  }

  // Success — single-use; invalidate every code for this email so an attacker can't continue racing.
  db.prepare('DELETE FROM email_codes WHERE email = ?').run(email)
  clear_failed_attempts(email)

  const { user, created } = find_or_create_auth_user({
    db,
    provider: 'email',
    provider_id: email,
    trusted_email: email,
    new_user: { email },
  })

  if (created) {
    // Fire-and-forget welcome email + admin notification. Failures don't
    // block sign-in — they get logged and we move on.
    void send_welcome_email({ email, name: user.name }).catch((err) => {
      console.error('[auth/verify] welcome email send failed:', err)
    })
  }

  const token = await sign_jwt({ sub: user.id, email: user.email ?? undefined, name: user.name ?? undefined })

  // httpOnly session cookie: trusted source of truth for both API auth and
  // SSR's `+layout.server.ts`. No `domain` attribute → host-only, so it works
  // for localhost, livingdictionaries.app, and (later) any subdomain without
  // conflict. `secure: !dev` lets us issue Secure=false on http://localhost in
  // pure local dev; in proxy mode the cookie comes from prod with Secure=true
  // and modern browsers (Chrome 89+, Firefox, Safari) accept Secure on
  // localhost.
  cookies.set('session', token, {
    path: '/',
    httpOnly: true,
    secure: !dev,
    sameSite: 'lax',
    maxAge: EXPIRY_SECONDS,
  })

  const full_user = get_user({ db, user_id: user.id })
  if (!full_user)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, 'Failed to load user after creation')

  return json({
    user: full_user,
  } satisfies AuthEmailVerifyResponseBody)
}
