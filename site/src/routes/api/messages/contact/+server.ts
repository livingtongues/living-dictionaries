import type { RequestHandler } from './$types'
import { randomUUID } from 'node:crypto'
import { dev } from '$app/environment'
import { env } from '$env/dynamic/private'
import { institute_no_reply_address, languages_7000_address } from '$lib/email/addresses'
import { send_email } from '$lib/email/send-email'
import { fire_agent_email_inbound } from '$lib/agent/email-inbound-hook'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { notify_admins } from '$lib/notifications/notify-admins'
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
  /** Machine key of the contact topic (e.g. `request_access`) — drives targeted routing. */
  subject_key?: string
  /** Set when the submission targets a specific dictionary (e.g. an access request). */
  dictionary_id?: string
  dictionary_name?: string
}

export interface MessagesContactResponseBody {
  ok: true
  thread_id: string
}

function get_internal_secret(): string | undefined {
  return env.INTERNAL_INGEST_SECRET
}

export const POST: RequestHandler = async ({ request, url: request_url }) => {
  const expected = get_internal_secret()
  if (!expected)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, 'INTERNAL_INGEST_SECRET not configured')

  const provided = request.headers.get('x-internal-secret')
  if (provided !== expected)
    error(ResponseCodes.UNAUTHORIZED, 'Invalid internal secret')

  const body = await request.json() as MessagesContactRequestBody
  const { name, email: raw_email, message, url, subject, subject_key, dictionary_id, dictionary_name } = body

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

  void notify_admins({
    subject: subject ? `New contact: ${subject}` : 'New contact form message',
    body: `${name?.trim() || email}: ${message.slice(0, 200)}`,
    link: `${request_url.origin}/admin/messages/${thread_id}`,
  })

  // Fire-and-forget LLM triage (classify + auto-assign + draft). Never blocks
  // the form response; run_triage swallows its own errors. to_email is null for
  // contact-form submissions (no inbound alias).
  fire_agent_email_inbound({
    thread_id,
    message_id: message_row_id,
    is_new_thread: true,
    from_email: email,
    to_email: null,
    subject: subject ?? '(contact form)',
  })

  // Targeted submissions still email the people who must personally act and
  // aren't on the admin team. Access requests email the dictionary's managers
  // (as the legacy `api/email/request_access` endpoint did).
  if (subject_key === 'request_access' && dictionary_id) {
    const managers = db.prepare(`
      SELECT users.name AS name, users.email AS email
      FROM dictionary_roles
      LEFT JOIN users ON users.id = dictionary_roles.user_id
      WHERE dictionary_roles.role = 'manager' AND dictionary_roles.dictionary_id = ?
    `).all(dictionary_id) as { name: string | null, email: string | null }[]

    const manager_addresses = managers
      .filter(manager => !!manager.email)
      .map(manager => ({ name: manager.name ?? undefined, email: manager.email as string }))

    if (manager_addresses.length) {
      void send_email({
        from: institute_no_reply_address,
        to: manager_addresses,
        reply_to: { email },
        subject: `${dictionary_name ?? 'Living Dictionary'}: ${email} requests editing access`,
        type: 'text/plain',
        body: `${message}\n\nSent by ${name?.trim() || 'Anonymous'} (${email}) from ${url}`,
      }).catch(err => console.error('request_access manager email failed:', err))
    }
  }

  // Learning-materials requests must reach the external 7000.org Languages
  // partner (the admin team already gets the backend thread + ntfy ping). Skip
  // in dev so we never email the real partner from a developer machine — same
  // dev-safety the legacy `api/email/learning_materials` endpoint had.
  if (subject_key === 'learning_materials' && !dev) {
    void send_email({
      from: institute_no_reply_address,
      to: [languages_7000_address],
      reply_to: { email },
      subject: `Request for learning materials - ${dictionary_name || 'unknown'} Living Dictionary`,
      type: 'text/plain',
      body: `${message}\n\nSent by ${name?.trim() || 'Anonymous'} (${email}) from ${url}`,
    }).catch(err => console.error('learning_materials 7000.org email failed:', err))
  }

  return json({ ok: true, thread_id } satisfies MessagesContactResponseBody)
}
