import type { SendEmailCommandOutput } from '@aws-sdk/client-ses'
import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses'
import { env } from '$env/dynamic/private'
import { no_reply_address } from './addresses'

const { AWS_SES_ACCESS_KEY_ID, AWS_SES_REGION, AWS_SES_SECRET_ACCESS_KEY } = env

interface EmailParts {
  from?: Address
  to: Address[]
  cc?: Address[]
  bcc?: Address[]
  reply_to?: Address
  subject: string
  /**
   * The message body. Two shapes accepted:
   *  - `{ body: string, type: 'text/plain' | 'text/html' }` — single-part
   *  - `{ body: { html: string, text?: string } }` — multipart (best
   *    deliverability; spam filters score it higher and clients show one
   *    or the other based on context). `type` is ignored in this shape.
   */
  body: string | { html: string, text?: string }
  type?: 'text/plain' | 'text/html'
  /** Defaults to false; when true the message will not be sent (logs body to console). */
  dry_run?: boolean
}

export interface Address {
  email: string
  name?: string
}

function format_address({ name, email }: Address): string {
  return name ? `${name} <${email}>` : email
}

// Rolling window of recent send timestamps for SES throttle (7/sec sandbox-default cap).
let sent_timestamps: number[] = []
// Promise chain so calls serialize and respect the throttle.
let sending_promise = Promise.resolve() as unknown as Promise<SendEmailCommandOutput | { message: string }>

export function send_email({ from, to, cc, bcc, reply_to, subject, body, type, dry_run }: EmailParts) {
  const send_single_email = async (recipient: Address) => {
    if (dry_run) {
      console.info('Dry run: email not sent')
      console.info('From:', format_address(from || no_reply_address))
      console.info('To:', format_address(recipient))
      if (cc)
        console.info('CC:', cc.map(format_address).join(', '))
      if (bcc)
        console.info('BCC:', bcc.map(format_address).join(', '))
      if (reply_to)
        console.info('Reply-To:', format_address(reply_to))
      console.info('Subject:', subject)
      console.info('Body:', body)
      return { message: 'Dry run completed, email not sent' }
    }

    const now = Date.now()
    sent_timestamps = sent_timestamps.filter(ts => now - ts < 1000)
    if (sent_timestamps.length >= 7) {
      const [oldest] = sent_timestamps
      const wait_time = oldest + 1000 - now
      if (wait_time > 0)
        await new Promise(resolve => setTimeout(resolve, wait_time))
    }

    if (!AWS_SES_ACCESS_KEY_ID || !AWS_SES_REGION || !AWS_SES_SECRET_ACCESS_KEY)
      throw new Error('AWS_SES credentials not configured')

    const ses_client = new SESClient({
      region: AWS_SES_REGION,
      credentials: {
        accessKeyId: AWS_SES_ACCESS_KEY_ID,
        secretAccessKey: AWS_SES_SECRET_ACCESS_KEY,
      },
    })

    const ses_body: { Text?: { Data: string }, Html?: { Data: string } } = {}
    if (typeof body === 'string') {
      if (type === 'text/plain')
        ses_body.Text = { Data: body }
      else
        ses_body.Html = { Data: body }
    } else {
      ses_body.Html = { Data: body.html }
      if (body.text)
        ses_body.Text = { Data: body.text }
    }

    try {
      const command = new SendEmailCommand({
        Source: format_address(from || no_reply_address),
        Destination: {
          ToAddresses: [format_address(recipient)],
          CcAddresses: cc?.map(format_address) || [],
          BccAddresses: bcc?.map(format_address) || [],
        },
        Message: {
          Subject: { Data: subject },
          Body: ses_body,
        },
        ReplyToAddresses: reply_to ? [format_address(reply_to)] : [],
      })

      const response = await ses_client.send(command)
      console.info('Email sent successfully to', recipient.email, 'Message ID:', response.MessageId)
      sent_timestamps.push(Date.now())
      return response
    } catch (err) {
      console.error('Error sending email to', recipient.email, ':', err)
      throw new Error(`Failed to send email to ${recipient.email}: ${(err as Error).message}`, { cause: err })
    }
  }

  for (const recipient of to)
    sending_promise = sending_promise.then(() => send_single_email(recipient))

  return sending_promise
}
