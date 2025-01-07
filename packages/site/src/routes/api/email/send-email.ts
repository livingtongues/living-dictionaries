import { dictionary_address, no_reply_address } from './addresses'
import { DKIM_PRIVATE_KEY, MAILCHANNELS_API_KEY } from '$env/static/private'

const MAILCHANNELS_API_URL = 'https://api.mailchannels.net/tx/v1/send'

export async function send_email({ from, to, cc, bcc, reply_to, subject, body, type, dry_run }: EmailParts) {
  if (!MAILCHANNELS_API_KEY)
    throw new Error('MAILCHANNELS_API_KEY env variable not configured')

  if (!DKIM_PRIVATE_KEY)
    throw new Error('DKIM_PRIVATE_KEY env variable not configured')

  if (to.length + (cc?.length || 0) + (bcc?.length || 0) > 1000)
    throw new Error('Maximum of 1000 recipients allowed')

  const mail_channels_send_body: MailChannelsSendBody = {
    personalizations: [{
      to,
      cc: cc || [],
      bcc: bcc || [],
      dkim_domain: 'livingdictionaries.app',
      dkim_selector: 'notification',
      dkim_private_key: DKIM_PRIVATE_KEY,
    }],
    from: from || no_reply_address,
    reply_to: reply_to || dictionary_address,
    subject,
    content: [{
      type,
      value: body,
    }],
  }

  const url = dry_run ? `${MAILCHANNELS_API_URL}?dry-run=true` : MAILCHANNELS_API_URL

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': MAILCHANNELS_API_KEY,
    },
    body: JSON.stringify(mail_channels_send_body),
  })

  // receives status 202 from MailChannels to indicate send pending
  if (!response.status.toString().startsWith('2')) {
    const body = await response.json()
    throw new Error(`MailChannels error: ${response.status} ${body.errors?.[0]}`)
  }
  return response
}

/** See https://api.mailchannels.net/tx/v1/documentation */
export interface EmailParts {
  from?: Address
  /** 1-1000 */
  to: Address[]
  /** 0-1000 */
  cc?: Address[]
  /** 0-1000 */
  bcc?: Address[]
  reply_to?: Address
  subject: string
  body: string
  type: 'text/plain' | 'text/html'
  /** Defaults to false, when setting true the message will not be sent. Instead, the fully rendered message is returned from MailChannels. */
  dry_run?: boolean
}

export interface Address {
  email: string
  name?: string
}

/** Source https://api.mailchannels.net/tx/v1/documentation */
interface MailChannelsSendBody {
  subject: string
  content: {
    /** The mime type of the content you are including in your email */
    type: 'text/plain' | 'text/html'
    /** The actual content of the specified mime type that you are including in the message */
    value: string
  }[]
  from: Address
  personalizations: {
    /** 1-1000 */
    to: Address[]
    from?: Address
    reply_to?: Address
    /** 0-1000 */
    cc?: Address[]
    /** 0-1000 */
    bcc?: Address[]
    subject?: string
    /* see https://mailchannels.zendesk.com/hc/en-us/articles/7122849237389-Adding-a-DKIM-Signature */
    dkim_domain: string
    /* Encoded in Base64 */
    dkim_private_key: string
    dkim_selector: string
    headers?: Record<string, string> // same as other headers
  }[] // (0...1000)
  reply_to?: Address
  /** A JSON object containing key/value pairs of header names and the value to substitute for them. The Key/value pairs must be strings. You must ensure these are properly encoded if they contain unicode characters. Must not be one of the reserved headers (received, dkim-signature, Content-Type, Content-Transfer-Encoding, To, From, Subject, Reply-To, CC, BCC). */
  headers?: Record<string, string>
}
