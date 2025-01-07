import { error, json } from '@sveltejs/kit'
import { getLanguageLearningMaterialsRecipients } from '../addresses'
import { send_email } from '../send-email'
import type { RequestHandler } from './$types'
import { dev } from '$app/environment'
import { ResponseCodes } from '$lib/constants'

export interface LearningMaterialsRequestBody {
  email: string
  message: string
  name: string
  url: string
  dictionaryName: string
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { email, message, name, url, dictionaryName } = await request.json() as LearningMaterialsRequestBody

    await send_email({
      to: getLanguageLearningMaterialsRecipients({ dev }),
      reply_to: { email },
      subject: `Request for learning materials - ${dictionaryName || 'unknown'} Living Dictionary`,
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
