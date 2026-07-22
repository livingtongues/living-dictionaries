import type { SendRawEmailCommandOutput } from '@aws-sdk/client-ses'
import { SendRawEmailCommand, SESClient } from '@aws-sdk/client-ses'
import { env } from '$env/dynamic/private'
import { createMimeMessage, Mailbox } from 'mimetext'
import type { Address } from './addresses'
import { support_address } from './addresses'

/**
 * Sends a raw MIME email via AWS SES `SendRawEmailCommand` — needed because
 * SES's high-level `SendEmail` doesn't expose the custom headers (`Message-ID`,
 * `In-Reply-To`, `References`, `Auto-Submitted`) required for RFC 5322 thread
 * continuity on admin replies.
 *
 * MIME assembly uses `mimetext` (`createMimeMessage`) — a tiny, dependency-light
 * builder. Note: `mimetext` sets the transfer-encoding *header* but does NOT
 * transcode the body/attachment bytes, so we base64-encode every part ourselves
 * (safe for arbitrary UTF-8) and normalize line endings to CRLF for SES.
 *
 * OTP delivery and one-off transactional sends that don't need threading headers
 * continue to use the simpler high-level `SendEmail` path.
 */

export interface Attachment {
  filename: string
  /** Raw bytes (Buffer) or UTF-8 text. */
  content: Buffer | string
  mimetype: string
  /** RFC 2392 cid for inline images referenced from html_body (e.g. `<img src="cid:logo@example.com">`). */
  content_id?: string
  /** Defaults to `'attachment'`. */
  disposition?: 'attachment' | 'inline'
}

export interface SendRawEmailParts {
  /** Defaults to `support_address`. */
  from?: Address
  to: Address
  cc?: Address[]
  bcc?: Address[]
  /** Defaults to `from`. */
  reply_to?: Address
  subject: string
  text_body?: string
  html_body?: string
  /**
   * Full RFC 5322 message identifier including angle brackets, e.g.
   * `<a1b2c3d4@example.com>`. Caller is responsible for generating; the reply
   * endpoint generates `<${crypto.randomUUID()}@…>` and persists this same
   * value on the `messages.message_id` column so inbound replies match via
   * `email_references` / `in_reply_to` lookups.
   */
  message_id: string
  /** Full angle-bracketed prior message_id, or null when this is the first message in a thread. */
  in_reply_to?: string | null
  /** All prior message_ids in chronological order, each angle-bracketed. Joined space-separated for the `References:` header. */
  references?: string[]
  /** RFC 3834. Defaults to `'no'` for human admin replies; agent replies should pass `'auto-generated'`. */
  auto_submitted?: 'no' | 'auto-generated' | 'auto-replied' | 'auto-notified'
  attachments?: Attachment[]
  /** When true, builds the MIME but doesn't send. Logs the raw envelope + first 200 chars to console. */
  dry_run?: boolean
}

function format_address({ name, email }: Address): string {
  return name ? `${name} <${email}>` : email
}

function to_mailbox({ email, name }: Address): { addr: string, name?: string } {
  return name ? { addr: email, name } : { addr: email }
}

/** Base64-encode a part's bytes and hard-wrap at 76 chars per RFC 2045. */
function to_base64_part(content: Buffer | string): string {
  const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content
  const base64 = buffer.toString('base64')
  return base64.match(/.{1,76}/g)?.join('\n') ?? base64
}

/**
 * Pure MIME builder. No SES dep, no env reads — fully unit-testable. Returns the
 * raw RFC 5322 string (CRLF line endings) that SES `SendRawEmailCommand` consumes.
 */
export function compose_raw_mime(parts: SendRawEmailParts): string {
  const {
    from = support_address,
    to,
    cc,
    bcc,
    reply_to,
    subject,
    text_body,
    html_body,
    message_id,
    in_reply_to,
    references,
    auto_submitted = 'no',
    attachments,
  } = parts

  if (!text_body && !html_body)
    throw new Error('send_raw_email requires at least one of text_body / html_body')

  const msg = createMimeMessage()
  msg.setSender(to_mailbox(from))
  msg.setRecipient(to_mailbox(to))
  if (cc?.length)
    msg.setCc(cc.map(to_mailbox))
  if (bcc?.length)
    msg.setBcc(bcc.map(to_mailbox))
  msg.setHeader('Reply-To', new Mailbox(to_mailbox(reply_to ?? from)))
  msg.setSubject(subject)
  msg.setHeader('Message-ID', message_id)
  msg.setHeader('Auto-Submitted', auto_submitted)
  if (in_reply_to)
    msg.setHeader('In-Reply-To', in_reply_to)
  if (references?.length)
    msg.setHeader('References', references.join(' '))

  if (text_body)
    msg.addMessage({ contentType: 'text/plain', encoding: 'base64', data: to_base64_part(text_body) })
  if (html_body)
    msg.addMessage({ contentType: 'text/html', encoding: 'base64', data: to_base64_part(html_body) })

  for (const attachment of attachments ?? []) {
    msg.addAttachment({
      filename: attachment.filename,
      contentType: attachment.mimetype,
      encoding: 'base64',
      data: to_base64_part(attachment.content),
      inline: attachment.disposition === 'inline',
      headers: attachment.content_id ? { 'Content-ID': attachment.content_id } : {},
    })
  }

  return msg.asRaw().replace(/\r\n|\r|\n/g, '\r\n')
}

/**
 * SES overrides our custom `Message-ID:` header with its own, so the recipient's
 * client threads on SES's id and their reply's `In-Reply-To` references it — NOT
 * the `<…@livingdictionaries.app>` we set. To make inbound-reply threading match
 * on headers (instead of only the subject heuristic), we reconstruct SES's id in
 * the RFC 5322 angle-bracketed form `<{SES MessageId}@{region}.amazonses.com>`
 * and persist it on the outbound `messages.message_id`. `us-east-1` uses the
 * legacy `email.amazonses.com` domain. Returns null when there's no real id
 * (dry-run / missing region) so callers keep the id they generated.
 */
export function build_ses_message_id({ ses_message_id, region }: {
  ses_message_id: string | undefined | null
  region: string | undefined | null
}): string | null {
  if (!ses_message_id || ses_message_id === 'dry-run' || !region)
    return null
  const domain = region === 'us-east-1' ? 'email.amazonses.com' : `${region}.amazonses.com`
  return `<${ses_message_id}@${domain}>`
}

let ses_client_singleton: SESClient | null = null
function get_ses_client(): SESClient {
  if (ses_client_singleton)
    return ses_client_singleton
  const { AWS_SES_ACCESS_KEY_ID, AWS_SES_REGION, AWS_SES_SECRET_ACCESS_KEY } = env
  if (!AWS_SES_ACCESS_KEY_ID || !AWS_SES_REGION || !AWS_SES_SECRET_ACCESS_KEY)
    throw new Error('AWS_SES_ACCESS_KEY_ID, AWS_SES_REGION, AWS_SES_SECRET_ACCESS_KEY must be configured')
  ses_client_singleton = new SESClient({
    region: AWS_SES_REGION,
    credentials: {
      accessKeyId: AWS_SES_ACCESS_KEY_ID,
      secretAccessKey: AWS_SES_SECRET_ACCESS_KEY,
    },
  })
  return ses_client_singleton
}

export async function send_raw_email(parts: SendRawEmailParts): Promise<{ ses_message_id: string, provider_message_id: string | null }> {
  const raw_mime = compose_raw_mime(parts)

  if (parts.dry_run) {
    console.info('Dry run: raw email not sent')
    console.info('From:', format_address(parts.from ?? support_address))
    console.info('To:', format_address(parts.to))
    console.info('Subject:', parts.subject)
    console.info('Message-ID:', parts.message_id)
    if (parts.in_reply_to)
      console.info('In-Reply-To:', parts.in_reply_to)
    if (parts.references?.length)
      console.info('References:', parts.references.join(' '))
    console.info('MIME size:', raw_mime.length, 'bytes')
    console.info('MIME preview:', raw_mime.slice(0, 200), '...')
    return { ses_message_id: 'dry-run', provider_message_id: null }
  }

  const ses_client = get_ses_client()
  const destinations = [
    format_address(parts.to),
    ...(parts.cc ?? []).map(format_address),
    ...(parts.bcc ?? []).map(format_address),
  ]

  try {
    const command = new SendRawEmailCommand({
      Source: format_address(parts.from ?? support_address),
      Destinations: destinations,
      RawMessage: { Data: Buffer.from(raw_mime, 'utf-8') },
    })
    const response: SendRawEmailCommandOutput = await ses_client.send(command)
    console.info('Raw email sent to', parts.to.email, '— SES MessageId:', response.MessageId, '— our Message-ID:', parts.message_id)
    const ses_message_id = response.MessageId ?? ''
    return {
      ses_message_id,
      provider_message_id: build_ses_message_id({ ses_message_id, region: env.AWS_SES_REGION }),
    }
  } catch (error) {
    console.error('Error sending raw email to', parts.to.email, ':', error)
    throw Object.assign(new Error(`Failed to send raw email to ${parts.to.email}: ${(error as Error).message}`), { cause: error })
  }
}

if (import.meta.vitest) {
  describe(build_ses_message_id, () => {
    test('wraps the SES id in the regional amazonses.com domain', () => {
      expect(build_ses_message_id({ ses_message_id: '010f-abc-000000', region: 'us-east-2' }))
        .toBe('<010f-abc-000000@us-east-2.amazonses.com>')
    })
    test('uses the legacy email.amazonses.com domain for us-east-1', () => {
      expect(build_ses_message_id({ ses_message_id: 'abc', region: 'us-east-1' }))
        .toBe('<abc@email.amazonses.com>')
    })
    test('returns null for a dry-run id, empty id, or missing region', () => {
      expect(build_ses_message_id({ ses_message_id: 'dry-run', region: 'us-east-2' })).toBeNull()
      expect(build_ses_message_id({ ses_message_id: '', region: 'us-east-2' })).toBeNull()
      expect(build_ses_message_id({ ses_message_id: 'abc', region: '' })).toBeNull()
    })
  })
}
