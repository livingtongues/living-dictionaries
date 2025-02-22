// import { DKIM_PRIVATE_KEY, MAILCHANNELS_API_KEY } from '$env/static/private'
import { SESClient, SendEmailCommand, type SendEmailCommandOutput } from '@aws-sdk/client-ses'
import { dictionary_address, no_reply_address } from './addresses'
import { AWS_SES_ACCESS_KEY_ID, AWS_SES_REGION, AWS_SES_SECRET_ACCESS_KEY } from '$env/static/private'

export interface EmailParts {
  from?: Address
  to: Address[]
  cc?: Address[]
  bcc?: Address[]
  reply_to?: Address
  subject: string
  body: string
  type: 'text/plain' | 'text/html'
  /** Defaults to false, when setting true the message will not be sent. */
  dry_run?: boolean
}

export interface Address {
  email: string
  name?: string
}

function format_address({ name, email }: Address): string {
  return name ? `${name} <${email}>` : email
}

// Rate-limiting variables
let sent_timestamps: number[] = [] // Tracks timestamps of sent emails
let sending_promise = Promise.resolve() as unknown as Promise<SendEmailCommandOutput | {
  message: string
}> // Ensures sequential sending

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
      console.info('Reply-To:', format_address(reply_to || dictionary_address))
      console.info('Subject:', subject)
      console.info('Body:', body)
      return { message: 'Dry run completed, email not sent' }
    }

    // Remove timestamps older than 1 second
    const now = Date.now()
    sent_timestamps = sent_timestamps.filter(ts => now - ts < 1000)
    // If 7 or more emails were sent in the last second, wait
    if (sent_timestamps.length >= 7) {
      const [oldest] = sent_timestamps
      const waitTime = oldest + 1000 - now
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }

    if (!AWS_SES_ACCESS_KEY_ID || !AWS_SES_REGION || !AWS_SES_SECRET_ACCESS_KEY) {
      throw new Error('AWS_SES credentials not configured')
    }

    const sesClient = new SESClient({
      region: AWS_SES_REGION,
      credentials: {
        accessKeyId: AWS_SES_ACCESS_KEY_ID,
        secretAccessKey: AWS_SES_SECRET_ACCESS_KEY,
      },
    })

    try {
      const command = new SendEmailCommand({
        Source: format_address(from || no_reply_address),
        Destination: {
          ToAddresses: [format_address(recipient)], // Single recipient per email
          CcAddresses: cc?.map(format_address) || [],
          BccAddresses: bcc?.map(format_address) || [],
        },
        Message: {
          Subject: { Data: subject },
          Body: {
            [type === 'text/plain' ? 'Text' : 'Html']: { Data: body },
          },
        },
        ReplyToAddresses: [format_address(reply_to || dictionary_address)],
      })

      const response = await sesClient.send(command)
      console.info('Email sent successfully to', recipient.email, 'Message ID:', response.MessageId)
      // Record timestamp after successful send
      sent_timestamps.push(Date.now())
      return response
    } catch (error) {
      console.error('Error sending email to', recipient.email, ':', error)
      throw new Error(`Failed to send email to ${recipient.email}: ${error.message}`)
    }
  }

  // Chain email sends for all recipients sequentially
  for (const recipient of to) {
    sending_promise = sending_promise.then(() => send_single_email(recipient))
  }

  // Return the promise chain so the caller can await completion
  return sending_promise
}
