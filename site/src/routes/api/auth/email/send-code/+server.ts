import type { RequestHandler } from './$types'
import { randomInt } from 'node:crypto'
import { dev } from '$app/environment'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { send_email } from '$lib/email/send-email'
import OtpEmail from '../../../email/components/OtpEmail.svelte'
import { render_component_to_html } from '../../../email/render-component-to-html'
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

export const POST: RequestHandler = async ({ request }) => {
  const { email: raw_email } = await request.json() as AuthEmailSendCodeRequestBody
  if (!raw_email)
    error(ResponseCodes.BAD_REQUEST, 'Email is required')

  const email = raw_email.trim().toLowerCase()

  if (!/^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(email))
    error(ResponseCodes.BAD_REQUEST, 'Invalid email format')

  const db = get_shared_db()

  // Garbage-collect expired codes for any email to keep the table from growing forever.
  db.prepare('DELETE FROM email_codes WHERE expires_at < strftime(\'%Y-%m-%dT%H:%M:%fZ\', \'now\')').run()

  const one_hour_ago = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const recent_count = db.prepare(
    'SELECT COUNT(*) as count FROM email_codes WHERE email = ? AND created_at > ?',
  ).get(email, one_hour_ago) as { count: number }

  if (recent_count.count >= MAX_CODES_PER_EMAIL_PER_HOUR)
    error(ResponseCodes.TOO_MANY_REQUESTS, 'Too many code requests. Please try again later.')

  // Invalidate previously-issued codes — keeps the live guessable surface at exactly one.
  db.prepare('DELETE FROM email_codes WHERE email = ?').run(email)

  const code = String(randomInt(100000, 999999))
  const expires_at = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000).toISOString()

  db.prepare('INSERT INTO email_codes (email, code, expires_at, created_at) VALUES (?, ?, ?, strftime(\'%Y-%m-%dT%H:%M:%fZ\', \'now\'))').run(email, code, expires_at)

  if (dev)
    return json({ result: 'success', code } satisfies AuthEmailSendCodeResponseBody)

  try {
    const html = render_component_to_html({
      component: OtpEmail,
      props: { code, minutes: CODE_EXPIRY_MINUTES },
    })
    const text = `${code} is your sign-in code for Living Dictionaries. It expires in ${CODE_EXPIRY_MINUTES} minutes.`
    await send_email({
      to: [{ email }],
      subject: `${code}: Sign-in code for Living Dictionaries`,
      body: { html, text },
    })
    return json({ result: 'success' } satisfies AuthEmailSendCodeResponseBody)
  } catch (err) {
    console.error(`Error sending email: ${(err as Error).message}`)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error sending email: ${(err as Error).message}`)
  }
}
