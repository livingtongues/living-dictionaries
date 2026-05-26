import type { SendRawEmailCommandOutput } from '@aws-sdk/client-ses'
import { SendRawEmailCommand, SESClient } from '@aws-sdk/client-ses'
import { env } from '$env/dynamic/private'
import MailComposer from 'nodemailer/lib/mail-composer'
import type { Address } from './send-email'
import { support_address } from './addresses'

/**
 * Sends a raw MIME email via AWS SES `SendRawEmailCommand` — needed because
 * SES's high-level `SendEmail` doesn't expose custom headers (`Message-ID`,
 * `In-Reply-To`, `References`, `Auto-Submitted`) and we need them for proper
 * RFC 5322 threading on admin replies.
 *
 * MIME assembly uses `nodemailer.MailComposer` (no SMTP transport — just
 * `.compile().build()` to get the raw buffer) so we don't hand-roll boundary
 * strings, RFC 2047 subject encoding, quoted-printable text, or base64
 * attachment wrapping.
 *
 * OTP delivery continues to use the simpler `send-email.ts` (high-level
 * `SendEmail`) since OTPs don't need threading headers.
 */

export interface Attachment {
  filename: string
  /** Raw bytes (Buffer) or UTF-8 text. */
  content: Buffer | string
  mimetype: string
  /** RFC 2392 cid for inline images referenced from body_html. */
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
   * `<a1b2c3d4@livingdictionaries.app>`. Caller is responsible for generating;
   * the reply endpoint generates `<${crypto.randomUUID()}@livingdictionaries.app>`
   * and persists this same value on the `messages.message_id` column so
   * inbound replies match via `email_references` / `in_reply_to` lookups.
   */
  message_id: string
  /** Full angle-bracketed prior message_id, or null when this is the first message in a thread. */
  in_reply_to?: string | null
  /** All prior message_ids in chronological order, each angle-bracketed. Joined space-separated for the `References:` header. */
  references?: string[]
  /** RFC 3834. Defaults to `'no'` for human admin replies; agent replies should pass `'auto-generated'`. */
  auto_submitted?: 'no' | 'auto-generated' | 'auto-replied' | 'auto-notified'
  attachments?: Attachment[]
  /** When true, builds the MIME but doesn't send. */
  dry_run?: boolean
}

function format_address({ name, email }: Address): string {
  return name ? `${name} <${email}>` : email
}

function compose_options(parts: SendRawEmailParts): Record<string, unknown> {
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

  const headers: Record<string, string> = {
    'Auto-Submitted': auto_submitted,
  }
  if (in_reply_to)
    headers['In-Reply-To'] = in_reply_to
  if (references && references.length > 0)
    headers.References = references.join(' ')

  return {
    from: format_address(from),
    to: format_address(to),
    cc: cc?.map(format_address),
    bcc: bcc?.map(format_address),
    replyTo: reply_to ? format_address(reply_to) : format_address(from),
    subject,
    text: text_body,
    html: html_body,
    messageId: message_id,
    headers,
    attachments: attachments?.map(att => ({
      filename: att.filename,
      content: att.content,
      contentType: att.mimetype,
      cid: att.content_id,
      contentDisposition: att.disposition ?? 'attachment',
    })),
  }
}

/**
 * Pure MIME builder. No SES dep, no env reads — fully unit-testable. Returns
 * the raw RFC 5322 byte buffer that SES `SendRawEmailCommand` consumes.
 */
export function compose_raw_mime(parts: SendRawEmailParts): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let mail: Record<string, unknown>
    try {
      mail = compose_options(parts)
    } catch (composer_error) {
      reject(composer_error instanceof Error ? composer_error : new Error(String(composer_error)))
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new MailComposer(mail as any).compile().build((err, message) => {
      if (err)
        reject(err)
      else
        resolve(message)
    })
  })
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

export async function send_raw_email(parts: SendRawEmailParts): Promise<{ ses_message_id: string }> {
  const raw_mime = await compose_raw_mime(parts)

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
    console.info('MIME size:', raw_mime.byteLength, 'bytes')
    console.info('MIME preview:', raw_mime.toString('utf-8').slice(0, 200), '...')
    return { ses_message_id: 'dry-run' }
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
      RawMessage: { Data: raw_mime },
    })
    const response: SendRawEmailCommandOutput = await ses_client.send(command)
    console.info('Raw email sent to', parts.to.email, '— SES MessageId:', response.MessageId, '— our Message-ID:', parts.message_id)
    return { ses_message_id: response.MessageId ?? '' }
  } catch (sender_error) {
    console.error('Error sending raw email to', parts.to.email, ':', sender_error)
    throw new Error(`Failed to send raw email to ${parts.to.email}: ${(sender_error as Error).message}`, { cause: sender_error })
  }
}
