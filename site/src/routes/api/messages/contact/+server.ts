import type { RequestHandler } from './$types'
import { randomUUID } from 'node:crypto'
import { env } from '$env/dynamic/private'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { error, json } from '@sveltejs/kit'

/**
 * Contact-form endpoint. Receives a JSON payload from the public site's
 * contact form (and, in the future, from the CF Worker that handles inbound
 * email's contact_form fallback for messages with no thread context).
 *
 * Auth: shared `X-Internal-Secret` header. The contact form runs on the same
 * LD origin so it can hit this endpoint via a same-origin fetch; the secret
 * keeps it from being abused as an open contact-firehose from the internet.
 *
 * Threading: contact-form messages always create a NEW thread. They have no
 * RFC `Message-ID:` to thread against.
 */

export interface MessagesContactRequestBody {
  name: string
  email: string
  message: string
  url: string
  subject?: string
}

export interface MessagesContactResponseBody {
  ok: true
  thread_id: string
}

function get_internal_secret(): string | undefined {
  return env.INTERNAL_INGEST_SECRET
}

export const POST: RequestHandler = async ({ request }) => {
  const expected = get_internal_secret()
  if (!expected)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, 'INTERNAL_INGEST_SECRET not configured')

  const provided = request.headers.get('x-internal-secret')
  if (provided !== expected)
    error(ResponseCodes.UNAUTHORIZED, 'Invalid internal secret')

  const body = await request.json() as MessagesContactRequestBody
  const { name, email: raw_email, message, url, subject } = body

  if (!raw_email || !message || !url)
    error(ResponseCodes.BAD_REQUEST, 'email, message, and url are required')

  const email = raw_email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(email))
    error(ResponseCodes.BAD_REQUEST, 'Invalid email format')

  const db = get_shared_db()

  const matching_user = db.prepare(
    'SELECT id FROM users WHERE email = ? COLLATE NOCASE LIMIT 1',
  ).get(email) as { id: string } | undefined

  const thread_id = randomUUID()
  const message_row_id = randomUUID()
  const now = new Date().toISOString()

  const insert = db.transaction(() => {
    db.prepare(`
      INSERT INTO message_threads (
        id, subject, source, from_user_id, from_email, from_name, url,
        last_message_at, created_at, updated_at
      ) VALUES (?, ?, 'contact_form', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      thread_id,
      subject ?? null,
      matching_user?.id ?? null,
      email,
      name?.trim() || null,
      url,
      now,
      now,
      now,
    )
    db.prepare(`
      INSERT INTO messages (
        id, thread_id, author_user_id, author_kind, body_text, created_at, updated_at
      ) VALUES (?, ?, ?, 'customer', ?, ?, ?)
    `).run(
      message_row_id,
      thread_id,
      matching_user?.id ?? null,
      message,
      now,
      now,
    )
  })

  insert()

  return json({ ok: true, thread_id } satisfies MessagesContactResponseBody)
}
