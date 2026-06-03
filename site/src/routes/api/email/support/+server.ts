import { error, json } from '@sveltejs/kit'
import { getSupportMessageRecipients } from '../addresses'
import { send_email } from '../send-email'
import type { RequestHandler } from './$types'
import { dev } from '$app/environment'
import { ResponseCodes } from '$lib/constants'

export interface SupportRequestBody {
  email: string
  message: string
  name: string
  url: string
  subject?: string
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { email, message, name, url, subject } = await request.json() as SupportRequestBody

    await send_email({
      to: getSupportMessageRecipients({ dev }),
      reply_to: { email },
      subject: subject || 'Living Dictionaries Support Request',
      type: 'text/plain',
      body: `${message} 

Sent by ${name} (${email}) from ${url}`,
    })

    return json('success')
  } catch (err) {
    console.error(`Error with email send request: ${err.message}`)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error with email send request: ${err.message}`)
  }
}
