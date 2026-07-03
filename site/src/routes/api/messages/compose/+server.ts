import type Database from 'better-sqlite3'
import type { Attachment } from '$lib/email/send-raw-email'
import type { ComposeRecipient } from '$lib/admin/messages/resolve-compose-recipient'
import type { RequestHandler } from './$types'
import { randomUUID } from 'node:crypto'
import { get_admin, is_admin } from '$lib/admins'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { support_address } from '$lib/email/addresses'
import { send_raw_email } from '$lib/email/send-raw-email'
import { assert_optional_recipients_allowed, resolve_compose_recipient_safe } from '$lib/admin/messages/resolve-compose-recipient'
import { put_attachment } from '$lib/r2/put-attachment'
import { error, json } from '@sveltejs/kit'

/**
 * Admin-initiated outbound email — starts *new* threads (no prior inbound).
 * Companion to `/api/messages/reply` which only sends within an existing
 * thread. Use case: admin wants to proactively email one or more users
 * (follow-up, onboarding, announcement), with optional attachments.
 *
 * Each To recipient gets its OWN individual email + thread (recipients never
 * see each other), which fits the 1:1 thread model and avoids leaking everyone's
 * address. Cc/Bcc are applied to every one of those sends. Each thread stores
 * `source='email'` so it sits alongside email-channel threads; when a recipient
 * replies, the catch-all → find-or-create-thread pipeline reattaches the reply
 * via the generated Message-ID.
 *
 * The admin authors a rich-text HTML body (Tiptap) which is sent straight
 * through — no `MessageReply` template wrap — so we don't second-guess their
 * styling. Falls back to a minimal text→HTML derivation when only plain text
 * is supplied.
 */

/** A file the admin attached, base64-encoded by the browser. */
export interface MessagesComposeAttachment {
  filename: string
  mimetype: string
  /** base64 of the raw bytes (no data: URL prefix). */
  content_b64: string
  content_id?: string | null
  disposition?: 'attachment' | 'inline'
}

/** A single To recipient — a registered user (`user_id`) OR a free-form `email`. */
export interface ComposeRecipientInput {
  user_id?: string
  email?: string
}

export interface MessagesComposeRequestBody {
  /** One or more To recipients — each gets an individual email + thread. */
  recipients: ComposeRecipientInput[]
  subject: string
  body_text: string
  body_html?: string
  /** Cc'd on every recipient's email (display-only record per message). */
  cc?: string[]
  /** Bcc'd on every recipient's email. */
  bcc?: string[]
  attachments?: MessagesComposeAttachment[]
  /**
   * Mark the new threads resolved on send. Admin-initiated outbound usually needs
   * no follow-up, so this defaults to `true` — keeps them out of the unresolved
   * inbox. Set `false` when a reply is expected (a customer reply re-opens any
   * resolved thread regardless).
   */
  resolve?: boolean
}

/** Per-recipient outcome. `thread_id`/`message_id` are null for recipients that
 *  failed to resolve before any thread was created (unknown user, bad/blocked
 *  email); send failures still create a (failed, retryable) thread. */
export interface ComposeSendResult {
  thread_id: string | null
  message_id: string | null
  rfc_message_id: string | null
  recipient_email: string
  recipient_name: string | null
  delivery_status: 'sent' | 'failed'
  delivery_error?: string
}

export interface MessagesComposeResponseBody {
  ok: true
  results: ComposeSendResult[]
}

export const POST: RequestHandler = async (event) => {
  const { user_id: admin_user_id, email: admin_email, name: admin_name } = await verify_auth(event)
  if (!is_admin(admin_email))
    error(ResponseCodes.FORBIDDEN, 'Admin only')

  const body = await event.request.json() as Partial<MessagesComposeRequestBody>
  if (typeof body.subject !== 'string' || !body.subject.trim())
    error(ResponseCodes.BAD_REQUEST, 'subject is required')
  if (typeof body.body_text !== 'string' || !body.body_text.trim())
    error(ResponseCodes.BAD_REQUEST, 'body_text is required')

  const recipients_input = normalize_recipients(body.recipients)
  if (recipients_input.length === 0)
    error(ResponseCodes.BAD_REQUEST, 'at least one recipient is required')

  // Cc/Bcc are request-level (shared across all sends) — reject blocked ones up front.
  assert_optional_recipients_allowed(body.cc)
  assert_optional_recipients_allowed(body.bcc)

  const db = get_shared_db()
  const subject = body.subject.trim()

  // Per-admin From — outbound goes from jacob@/diego@/annaluisa@/greg@ so the
  // recipient sees a real person. Same fallback as the reply endpoint.
  const admin_record = get_admin(admin_email)
  const from_address = admin_record
    ? { email: admin_record.ld_address, name: admin_record.name }
    : support_address

  const html_body = body.body_html?.trim() ? body.body_html : text_to_safe_html(body.body_text)

  // Decode attachments once — buffers reused across every recipient's send.
  const decoded_attachments = (body.attachments ?? []).map(att => ({
    ...att,
    buffer: Buffer.from(att.content_b64, 'base64'),
  }))
  const send_attachments: Attachment[] = decoded_attachments.map(att => ({
    filename: att.filename,
    content: att.buffer,
    mimetype: att.mimetype,
    content_id: att.content_id ?? undefined,
    disposition: att.disposition ?? 'attachment',
  }))

  const results: ComposeSendResult[] = []
  const seen_emails = new Set<string>()
  for (const input of recipients_input) {
    const resolved = resolve_compose_recipient_safe({ db, to_user_id: input.user_id, to_email: input.email })
    if (!resolved.recipient) {
      results.push({
        thread_id: null,
        message_id: null,
        rfc_message_id: null,
        recipient_email: input.email ?? input.user_id ?? '(unknown)',
        recipient_name: null,
        delivery_status: 'failed',
        delivery_error: resolved.error ?? 'recipient resolution failed',
      })
      continue
    }
    const key = resolved.recipient.email.toLowerCase()
    if (seen_emails.has(key))
      continue
    seen_emails.add(key)

    results.push(await send_to_one({
      db,
      admin_user_id,
      admin_email,
      admin_name,
      recipient: resolved.recipient,
      subject,
      body,
      from_address,
      html_body,
      decoded_attachments,
      send_attachments,
    }))
  }

  return json({ ok: true, results } satisfies MessagesComposeResponseBody)
}

function normalize_recipients(raw: unknown): ComposeRecipientInput[] {
  if (!Array.isArray(raw))
    return []
  const out: ComposeRecipientInput[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object')
      continue
    const record = item as Record<string, unknown>
    const user_id = typeof record.user_id === 'string' && record.user_id.trim() ? record.user_id.trim() : undefined
    const email = typeof record.email === 'string' && record.email.trim() ? record.email.trim() : undefined
    if (user_id || email)
      out.push({ user_id, email })
  }
  return out
}

async function send_to_one({ db, admin_user_id, admin_email, admin_name, recipient, subject, body, from_address, html_body, decoded_attachments, send_attachments }: {
  db: Database.Database
  admin_user_id: string
  admin_email: string
  admin_name?: string | null
  recipient: ComposeRecipient
  subject: string
  body: Partial<MessagesComposeRequestBody>
  from_address: { email: string, name?: string }
  html_body: string
  decoded_attachments: (MessagesComposeAttachment & { buffer: Buffer })[]
  send_attachments: Attachment[]
}): Promise<ComposeSendResult> {
  const thread_id = randomUUID()
  const message_row_id = randomUUID()
  const rfc_message_id = `<${randomUUID()}@livingdictionaries.app>`
  const now = new Date().toISOString()

  // Insert thread + pending message BEFORE sending so a crash or sync mid-send
  // never loses the attempt. delivery_status flips after the SES result.
  insert_thread_with_pending_message({ db, thread_id, message_row_id, admin_user_id, recipient, subject, body, rfc_message_id, now })
  await persist_attachments({ db, message_row_id, attachments: decoded_attachments, now })

  try {
    await send_raw_email({
      from: from_address,
      to: { email: recipient.email, name: recipient.name ?? undefined },
      cc: body.cc?.map(addr => ({ email: addr })),
      bcc: body.bcc?.map(addr => ({ email: addr })),
      subject,
      text_body: body.body_text,
      html_body,
      message_id: rfc_message_id,
      in_reply_to: null,
      references: [],
      auto_submitted: 'no',
      attachments: send_attachments,
    })

    db.prepare(`UPDATE messages SET sent_at = ?, delivery_status = 'sent', updated_at = ? WHERE id = ?`)
      .run(now, new Date().toISOString(), message_row_id)
    // Admin's outbound is the first (and only) message in the thread, so the
    // same workflow flags apply as a reply. Default to resolved (nothing pending)
    // unless the admin unchecked "Mark as resolved"; a customer reply re-opens it.
    const should_resolve = body.resolve ?? true
    if (should_resolve) {
      db.prepare(`UPDATE message_threads SET replied_at = ?, replied_by_user_id = ?, resolved_at = ?, resolved_by_user_id = ?, updated_at = ? WHERE id = ?`)
        .run(now, admin_user_id, now, admin_user_id, new Date().toISOString(), thread_id)
    } else {
      db.prepare(`UPDATE message_threads SET replied_at = ?, replied_by_user_id = ?, updated_at = ? WHERE id = ?`)
        .run(now, admin_user_id, new Date().toISOString(), thread_id)
    }

    return { thread_id, message_id: message_row_id, rfc_message_id, recipient_email: recipient.email, recipient_name: recipient.name, delivery_status: 'sent' }
  } catch (err) {
    const delivery_error = (err as Error).message
    db.prepare(`UPDATE messages SET delivery_status = 'failed', delivery_error = ?, updated_at = ? WHERE id = ?`)
      .run(delivery_error, new Date().toISOString(), message_row_id)
    console.error('Compose send failed for thread', thread_id, 'by admin', admin_name ?? admin_email, ':', delivery_error)
    return { thread_id, message_id: message_row_id, rfc_message_id, recipient_email: recipient.email, recipient_name: recipient.name, delivery_status: 'failed', delivery_error }
  }
}

function text_to_safe_html(text: string): string {
  const escape = (value: string) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  const paragraphs = text.split(/\n\s*\n/).map(part => part.trim()).filter(Boolean)
  return paragraphs
    .map(part => `<p style="margin: 0 0 14px;">${escape(part).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

function insert_thread_with_pending_message({ db, thread_id, message_row_id, admin_user_id, recipient, subject, body, rfc_message_id, now }: {
  db: Database.Database
  thread_id: string
  message_row_id: string
  admin_user_id: string
  recipient: { user_id: string | null, email: string, name: string | null }
  subject: string
  body: Partial<MessagesComposeRequestBody>
  rfc_message_id: string
  now: string
}): void {
  const insert = db.transaction(() => {
    db.prepare(`
      INSERT INTO message_threads (
        id, subject, source, from_user_id, from_email, from_name,
        last_message_at, created_at, updated_at
      ) VALUES (?, ?, 'email', ?, ?, ?, ?, ?, ?)
    `).run(thread_id, subject, recipient.user_id, recipient.email, recipient.name, now, now, now)
    db.prepare(`
      INSERT INTO messages (
        id, thread_id, author_user_id, author_kind,
        body_text, body_html,
        message_id, in_reply_to, email_references, cc, bcc,
        delivery_status, created_at, updated_at
      ) VALUES (?, ?, ?, 'admin', ?, ?, ?, NULL, NULL, ?, ?, 'pending', ?, ?)
    `).run(
      message_row_id,
      thread_id,
      admin_user_id,
      body.body_text ?? null,
      body.body_html ?? null,
      rfc_message_id,
      body.cc?.length ? body.cc.join(', ') : null,
      body.bcc?.length ? body.bcc.join(', ') : null,
      now,
      now,
    )
  })
  insert()
}

async function persist_attachments({ db, message_row_id, attachments, now }: {
  db: Database.Database
  message_row_id: string
  attachments: (MessagesComposeAttachment & { buffer: Buffer })[]
  now: string
}): Promise<void> {
  // Upload to R2 first — failures throw before any DB row is written.
  const prepared = await Promise.all(
    attachments.map(async (att) => {
      const attachment_id = randomUUID()
      await put_attachment({ attachment_id, content: att.buffer, mimetype: att.mimetype })
      return { attachment_id, att }
    }),
  )

  const insert = db.prepare(`
    INSERT INTO message_attachments (
      id, message_id, filename, mimetype, size_bytes,
      content_id, disposition, storage_key, created_at, updated_at
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
