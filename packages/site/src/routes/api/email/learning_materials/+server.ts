import { error, json } from '@sveltejs/kit'
import type { EmailParts } from '../send/mail-channels.interface'
import { getLanguageLearningMaterialsRecipients } from '../addresses'
import type { RequestHandler } from './$types'
import { dev } from '$app/environment'
import { SEND_EMAIL_KEY } from '$env/static/private'
import { ResponseCodes } from '$lib/constants'
import { post_request } from '$lib/helpers/get-post-requests'
import type { SendRequestBody } from '$api/email/send/+server'

export interface LearningMaterialsRequestBody {
  email: string
  message: string
  name: string
  url: string
  dictionaryName: string
}

export const POST: RequestHandler = async ({ request, fetch }) => {
  const { email, message, name, url, dictionaryName } = await request.json() as LearningMaterialsRequestBody
  const emailParts: EmailParts = {
    to: getLanguageLearningMaterialsRecipients({ dev }),
    reply_to: { email },
    subject: `Request for learning materials - ${dictionaryName || 'unknown'} Living Dictionary`,
    type: 'text/plain',
    body: `${message} 

Sent by ${name} (${email}) from ${url}`,
  }

  const { error: email_send_error } = await post_request<SendRequestBody, null>('/api/email/send', { send_key: SEND_EMAIL_KEY, emailParts }, { fetch })

  if (email_send_error)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, email_send_error)

  return json('success')
}
