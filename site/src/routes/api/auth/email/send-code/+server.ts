import type { RequestHandler } from './$types'
import { randomInt } from 'node:crypto'
import { dev } from '$app/environment'
import { env } from '$env/dynamic/private'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { send_email } from '../../../email/send-email'
import { error, json } from '@sveltejs/kit'

export interface AuthEmailSendCodeRequestBody {
  email: string
}

export interface AuthEmailSendCodeResponseBody {
  result: 'success'
  /** In dev, the code is returned so we don't have to check inboxes. */
  code?: string
}

const CODE_EXPIRY_MINUTES = 30
const MAX_CODES_PER_EMAIL_PER_HOUR = 10
const SEND_WINDOW_MS = 60 * 60 * 1000

/**
 * In-memory rolling counter of send-code requests per email. We can't count
 * `email_codes` rows for this — the "invalidate previous codes" DELETE below
 * wipes them on every call, so the count would never exceed 1 (a latent bug
 * inherited from the example, which counted rows). Mirrors the verify
 * endpoint's in-memory failed-attempt tracking: resets on restart, acceptable
 * for a single-process-per-VPS deploy.
 */
const send_attempts = new Map<string, number[]>()

function track_send_attempt(email: string): number {
  const now = Date.now()
  const window_start = now - SEND_WINDOW_MS
  const history = (send_attempts.get(email) ?? []).filter(timestamp => timestamp >= window_start)
  history.push(now)
  send_attempts.set(email, history)
  return history.length
}

export const POST: RequestHandler = async ({ request }) => {
  const { email: raw_email } = await request.json() as AuthEmailSendCodeRequestBody
  if (!raw_email)
    error(ResponseCodes.BAD_REQUEST, 'Email is required')

  const email = raw_email.trim().toLowerCase()

  if (!/^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(email))
    error(ResponseCodes.BAD_REQUEST, 'Invalid email format')

  if (track_send_attempt(email) > MAX_CODES_PER_EMAIL_PER_HOUR)
    error(ResponseCodes.TOO_MANY_REQUESTS, 'Too many code requests. Please try again later.')

  const db = get_shared_db()

  // Garbage-collect expired codes for any email to keep the table from growing forever.
  db.prepare('DELETE FROM email_codes WHERE expires_at < strftime(\'%Y-%m-%dT%H:%M:%fZ\', \'now\')').run()

  // Invalidate previously-issued codes — keeps the live guessable surface at exactly one.
  db.prepare('DELETE FROM email_codes WHERE email = ?').run(email)

  const code = String(randomInt(100000, 999999))
  const expires_at = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000).toISOString()

  db.prepare('INSERT INTO email_codes (email, code, expires_at, created_at) VALUES (?, ?, ?, strftime(\'%Y-%m-%dT%H:%M:%fZ\', \'now\'))').run(email, code, expires_at)

  // Dev returns the code inline so we skip inboxes. `E2E_EXPOSE_OTP` does the
  // same against a production `node build` for the headless e2e — explicit,
  // env-gated, and never set in real deployments.
  if (dev || env.E2E_EXPOSE_OTP === 'true')
    return json({ result: 'success', code } satisfies AuthEmailSendCodeResponseBody)

  try {
    await send_email({
      to: [{ email }],
      subject: `${code}: Sign-in code for Living Dictionaries`,
      body: `${code} is your sign-in code for Living Dictionaries. It expires in ${CODE_EXPIRY_MINUTES} minutes.`,
      type: 'text/plain',
    })
    return json({ result: 'success' } satisfies AuthEmailSendCodeResponseBody)
  } catch (err) {
    console.error(`Error sending email: ${(err as Error).message}`)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error sending email: ${(err as Error).message}`)
  }
}
