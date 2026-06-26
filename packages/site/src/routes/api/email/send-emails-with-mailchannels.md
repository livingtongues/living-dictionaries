# Use MailChannels API to Send Emails

## API Keys

- Add blank keys to your committed `.env` file:

  ```
  MAILCHANNELS_API_KEY=
  DKIM_PRIVATE_KEY=
  ```

- get MailChannels API keys for local and prod at https://console.mailchannels.net/; add the local key to an uncommitted `.env.local` file for local testing. Add the prod key to the environment variables wherever production is deployed.

## Set up DNS Records for MailChannels verification and DKIM signing

- Read sources:
  - https://mailchannels.zendesk.com/hc/en-us/articles/7122849237389-Adding-a-DKIM-Signature
  - https://support.mailchannels.com/hc/en-us/articles/16918954360845-Secure-your-domain-name-against-spoofing-with-Domain-Lockdown

- Under `Cloudflare > Website > yours.com > Email > Email Routing > Settings` ensure that your domain is setup for email. If you already have this setup you'll have three `MX` records and one `TXT` record related to email sending.
- In the DNS Records page, edit the `TXT` record at `livingdictionaries.app` from `v=spf1 include:_spf.mx.cloudflare.net ~all` to `v=spf1 a mx include:relay.mailchannels.net include:_spf.mx.cloudflare.net ~all`

- Add a `_mailchannels` `TXT` record to let mailchannels know the API account that emails are coming from: `v=mc1 auth=polylingualdevelopmentllc`

- Create a private key by running in bash: `openssl genrsa 2048 | tee priv_key.pem | openssl rsa -outform der | openssl base64 -A > priv_key.txt`
  - Take the value from `priv_key.txt` and add it to your environment variables (`.env.local` and in your deployment environment) as `DKIM_PRIVATE_KEY`.

- Create a public key from your private key by running `echo -n "v=DKIM1;p=" > pub_key.txt && openssl rsa -in priv_key.pem -pubout -outform der | openssl base64 -A >> pub_key.txt`
  - Take the output of `pub_key.txt` and add it to your DNS records as a `TXT` entry under `notification._domainkey`. It will look like this: `v=DKIM1; p=<your DKIM public key>`. The use of `notification` is arbitrary here but it must match the `dkim_selector` field in the `send_email` function we will set up further on.

- Then go to `Cloudflare > Website > yours.com > Email > DMARC Management` and click `Enable DMARC Management` to automatically add a `_dmarc` TXT record to keep other people from being able to spoof your domain in emails. It will look something like this: `v=DMARC1;  p=none; rua=mailto:1212-long-string@dmarc-reports.cloudflare.net`. That's a good place to start. Read https://dmarc.org/overview/ to learn more about making your policy more restrictive. Right now I update the `p=none;` to `p=quarantine; sp=reject; adkim=r; aspf=r;`. Here's a short overview of what this means:
  - `p=quarantine;` - `p` is the policy for the domain. This tells email servers to quarantine emails that fail the DMARC check. This means that the email may be sent with a warning or be put in the spam folder.
  - `sp=reject;` - `sp` is the policy for subdomains. This tells email servers to reject emails that fail the DMARC check which come from subdomains of my main domain.
  - `adkim=r;` - This tells email servers to use relaxed alignment for DKIM, meaning the DKIM signature can be in the header or the body of the email.
  - `aspf=r;` - This tells email servers to use relaxed alignment for SPF, meaning the SPF signature can be in the header or the body of the email.

As mentioned in https://dmarc.org/overview/, it is a good idea to work towards marking `p` as `reject`.

## Server Endpoint

Create a `routes/api/email/send-email.ts` file:

```ts
import { DKIM_PRIVATE_KEY, MAILCHANNELS_API_KEY } from '$env/static/private'

const MAILCHANNELS_API_URL = 'https://api.mailchannels.net/tx/v1/send'

export async function send_email({ from, to, cc, bcc, reply_to, subject, body, type, dry_run }: EmailParts) {
  if (!MAILCHANNELS_API_KEY)
    throw new Error('MAILCHANNELS_API_KEY env variable not configured')

  if (!DKIM_PRIVATE_KEY)
    throw new Error('DKIM_PRIVATE_KEY env variable not configured')

  const mail_channels_send_body: MailChannelsSendBody = {
    from,
    personalizations: [{
      to,
      cc: cc || [],
      bcc: bcc || [],
      dkim_domain: 'livingdictionaries.app',
      dkim_selector: 'notification',
      dkim_private_key: DKIM_PRIVATE_KEY,
    }],
    reply_to,
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
interface EmailParts {
  from: Address
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

interface Address {
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
```

If you don't have an actual email inbox under your domain, you can do one of two things:
- In `Cloudflare > Website > Email > Email Routing > Routing Rules`, you can setup the email address that you send from to forward to your actual email.
- You can use a `no-reply` address in the from field and then use an actual email in the `reply_to` field. Here's an example of a `no-reply` address:

```ts
const no_reply_address: Address = {
  email: 'no-reply@livingdictionaries.app',
  name: 'Living Dictionaries',
}
```

Now we can use our `send_email` function in a SvelteKit server endpoint like this:

```ts
import { error, json } from '@sveltejs/kit'
import { send_email } from '../send-email'
import type { RequestHandler } from './$types'

export interface NewUserEmailRequestBody {
  name: string
}

export const POST: RequestHandler = async ({ locals: { getSession }, request }) => {
  const { data: session_data, error: _error, supabase } = await getSession()
  if (_error || !session_data?.user) // 👈 Adjust auth check based on authentication setup to keep just anyone from being able to use this endpoint.
    error(ResponseCodes.UNAUTHORIZED, { message: _error.message || 'Unauthorized' })

  try {
    const { name } = await request.json() as NewUserEmailRequestBody

    await send_email({
      from: { email: 'hello@livingdictionaries.app', name: 'Someone' },
      to: [{ email: session_data.user.email, name }],
      subject: 'Welcome!',
      body: `Hi ${name},\n\nWelcome to Living Dictionaries!`,
      type: 'text/plain',
    })

    return json({ result: 'success' })
  } catch (err) {
    console.error(`Error with email send request: ${err.message}`)
    error(500, `Error with email send request: ${err.message}`)
  }
}
```
