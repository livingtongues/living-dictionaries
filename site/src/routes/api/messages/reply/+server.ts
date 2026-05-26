import type Database from 'better-sqlite3'
import type { Attachment } from '$lib/email/send-raw-email'
import type { RequestHandler } from './$types'
import { randomUUID } from 'node:crypto'
import { is_admin } from '$lib/admins'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { support_address } from '$lib/email/addresses'
import { is_blocked_recipient } from '$lib/email/loop-protection'
import { send_raw_email } from '$lib/email/send-raw-email'
import { put_attachment } from '$lib/r2/put-attachment'
import MessageReply from '../../email/components/MessageReply.svelte'
import { render_component_to_html } from '../../email/render-component-to-html'
import { error, json } from '@sveltejs/kit'

/**
 * Admin-authored outbound reply. Generates a fresh `Message-ID`, composes
 * RFC threading headers from the thread's prior message_ids, sends via SES
 * `SendRawEmailCommand`, persists an outbound `messages` row + attachment
 * rows, and updates thread workflow state (replied_at, replied_by_user_id).
 *
 * LD-specific: all replies are sent from `support@livingdictionaries.app`.
 * (House has per-admin `*@hvsb.app` aliases — LD doesn't have that
 * `hvsb_address`-equivalent column on `lib/admins.ts` yet. When LD wants
 * per-admin reply addresses, add it then.)
 */

export interface MessagesReplyAttachment {
  filename: string
  mimetype: string
  /** Base64-encoded raw bytes. */
  content_b64: string
  content_id?: string | null
  disposition?: 'attachment' | 'inline'
}

export interface MessagesReplyRequestBody {
  thread_id: string
  body_text: string
  body_html?: string
  cc?: string[]
  bcc?: string[]
  attachments?: MessagesReplyAttachment[]
}

export interface MessagesReplyResponseBody {
  ok: true
  message_id: string
  rfc_message_id: string
  delivery_status: 'sent' | 'failed'
  delivery_error?: string
}

interface ThreadRow {
  id: string
  subject: string | null
  from_email: string
  from_name: string | null
}

export const POST: RequestHandler = async (event) => {
  const { user_id, email, name } = await verify_auth(event)
  if (!is_admin(email))
    error(ResponseCodes.FORBIDDEN, 'Admin only')

  const body = await event.request.json() as Partial<MessagesReplyRequestBody>
  if (typeof body.thread_id !== 'string' || typeof body.body_text !== 'string' || !body.body_text.trim())
    error(ResponseCodes.BAD_REQUEST, 'thread_id and body_text are required')

  const db = get_shared_db()
  const thread = db.prepare(
    `SELECT id, subject, from_email, from_name FROM message_threads WHERE id = ?`,
  ).get(body.thread_id) as ThreadRow | undefined
  if (!thread)
    error(ResponseCodes.NOT_FOUND, 'Thread not found')

  if (is_blocked_recipient(thread.from_email))
    error(ResponseCodes.BAD_REQUEST, `Refusing to send to blocked recipient: ${thread.from_email}`)

  const prior_message_ids = db.prepare(
    `SELECT message_id FROM messages
     WHERE thread_id = ? AND message_id IS NOT NULL
     ORDER BY created_at ASC`,
  ).all(body.thread_id) as { message_id: string }[]
  const references = prior_message_ids.map(r => r.message_id)
  const in_reply_to = references.length > 0 ? references[references.length - 1] : null

  const message_row_id = randomUUID()
  const rfc_message_id = `<${randomUUID()}@livingdictionaries.app>`
  const now = new Date().toISOString()

  // Insert pending row + attachments BEFORE sending, so a sync between
  // pending and sent never loses the record. delivery_status flips after.
  insert_outbound_pending({
    db,
    message_row_id,
    thread_id: thread.id,
    admin_user_id: user_id,
    body,
    rfc_message_id,
    in_reply_to,
    references,
    now,
  })

  // Decode each attachment once — the same Buffer is uploaded to R2 AND
  // handed to MailComposer for the outbound MIME, so we never round-trip
  // through R2 just to send.
  const decoded_attachments = (body.attachments ?? []).map(att => ({
    ...att,
    buffer: Buffer.from(att.content_b64, 'base64'),
  }))

  await persist_attachments({
    db,
    message_row_id,
    attachments: decoded_attachments,
    now,
  })

  // Bump last_message_at so the admin sees their attempt in the thread
  // immediately regardless of delivery outcome.
  db.prepare(`
    UPDATE message_threads
    SET last_message_at = ?,
        updated_at = ?
    WHERE id = ?
  `).run(now, now, thread.id)

  const send_attachments: Attachment[] = decoded_attachments.map(att => ({
    filename: att.filename,
    content: att.buffer,
    mimetype: att.mimetype,
    content_id: att.content_id ?? undefined,
    disposition: att.disposition ?? 'attachment',
  }))

  const reply_subject = compose_reply_subject(thread.subject)

  // Wrap the admin's authored HTML (or auto-derive from text) in the
  // MessageReply template — gives an email-safe scaffold, mobile-friendly
  // typography, and dark-mode CSS. Plain-text part stays exactly what the
  // admin typed (preserves intent, no double-templating).
  const inner_html = body.body_html ?? text_to_safe_html(body.body_text)
  const wrapped_html = render_component_to_html({
    component: MessageReply,
    props: {
      body_html: inner_html,
      preheader: body.body_text.trim().slice(0, 140),
      subject: reply_subject,
    },
  })

  // LD ships all admin replies from `support@livingdictionaries.app` — no
  // per-admin alias system yet.
  const from_address = support_address

  // Send via SES — failure marks the row as 'failed' but doesn't throw.
  try {
    await send_raw_email({
      from: from_address,
      to: {
        email: thread.from_email,
        name: thread.from_name ?? undefined,
      },
      reply_to: from_address,
      cc: body.cc?.map(addr => ({ email: addr })),
      bcc: body.bcc?.map(addr => ({ email: addr })),
      subject: reply_subject,
      text_body: body.body_text,
      html_body: wrapped_html,
      message_id: rfc_message_id,
      in_reply_to,
      references,
      auto_submitted: 'no',
      attachments: send_attachments,
    })

    db.prepare(`
      UPDATE messages
      SET sent_at = ?, delivery_status = 'sent', updated_at = ?
      WHERE id = ?
    `).run(now, new Date().toISOString(), message_row_id)

    // Mark the thread as replied. `COALESCE` preserves the original
    // first-reply timestamp on subsequent replies.
    db.prepare(`
      UPDATE message_threads
      SET replied_at = COALESCE(replied_at, ?),
          replied_by_user_id = COALESCE(replied_by_user_id, ?),
          updated_at = ?
      WHERE id = ?
    `).run(now, user_id, new Date().toISOString(), thread.id)

    return json({
      ok: true,
      message_id: message_row_id,
      rfc_message_id,
      delivery_status: 'sent',
    } satisfies MessagesReplyResponseBody)
  } catch (send_error) {
    const delivery_error = (send_error as Error).message
    db.prepare(`
      UPDATE messages
      SET delivery_status = 'failed', delivery_error = ?, updated_at = ?
      WHERE id = ?
    `).run(delivery_error, new Date().toISOString(), message_row_id)
    console.error('Reply send failed for thread', thread.id, 'by admin', name ?? email, ':', delivery_error)
    return json({
      ok: true,
      message_id: message_row_id,
      rfc_message_id,
      delivery_status: 'failed',
      delivery_error,
    } satisfies MessagesReplyResponseBody)
  }
}

function compose_reply_subject(thread_subject: string | null): string {
  const subject = thread_subject?.trim() || '(no subject)'
  if (/^\s*re\s*:/i.test(subject))
    return subject
  return `Re: ${subject}`
}

/**
 * Escapes text for safe injection into HTML and converts double newlines to
 * <p> paragraphs, single newlines to <br>. Used when the admin didn't author
 * an HTML version — we derive one from the plain text so the recipient still
 * gets the template's typography + dark-mode handling.
 */
function text_to_safe_html(text: string): string {
  const escape = (sample: string) => sample
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
  return paragraphs
    .map(p => `<p style="margin: 0 0 14px;">${escape(p).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

function insert_outbound_pending({
  db,
  message_row_id,
  thread_id,
  admin_user_id,
  body,
  rfc_message_id,
  in_reply_to,
  references,
  now,
}: {
  db: Database.Database
  message_row_id: string
  thread_id: string
  admin_user_id: string
  body: Partial<MessagesReplyRequestBody>
  rfc_message_id: string
  in_reply_to: string | null
  references: string[]
  now: string
}): void {
  db.prepare(`
    INSERT INTO messages (
      id, thread_id, author_user_id, author_kind,
      body_text, body_html,
      message_id, in_reply_to, email_references,
      delivery_status,
      created_at, updated_at
    ) VALUES (?, ?, ?, 'admin', ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(
    message_row_id,
    thread_id,
    admin_user_id,
    body.body_text ?? null,
    body.body_html ?? null,
    rfc_message_id,
    in_reply_to,
    references.length > 0 ? references.join(' ') : null,
    now,
    now,
  )
}

async function persist_attachments({
  db,
  message_row_id,
  attachments,
  now,
}: {
  db: Database.Database
  message_row_id: string
  attachments: (MessagesReplyAttachment & { buffer: Buffer })[]
  now: string
}): Promise<void> {
  // Upload all attachments to R2 first; if any fail, throw before we touch
  // the DB so the caller can roll back / surface the error to the admin.
  const prepared = await Promise.all(
    attachments.map(async (att) => {
      const attachment_id = randomUUID()
      await put_attachment({
        attachment_id,
        content: att.buffer,
        mimetype: att.mimetype,
      })
      return { attachment_id, att }
    }),
  )

  const insert = db.prepare(`
    INSERT INTO message_attachments (
      id, message_id, filename, mimetype, size_bytes,
      content_id, disposition, storage_key,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  for (const { attachment_id, att } of prepared) {
    insert.run(
      attachment_id,
      message_row_id,
      att.filename,
      att.mimetype,
      att.buffer.byteLength,
      att.content_id ?? null,
      att.disposition ?? 'attachment',
      attachment_id, // storage_key === attachment_id (R2 object key)
      now,
      now,
    )
  }
}
