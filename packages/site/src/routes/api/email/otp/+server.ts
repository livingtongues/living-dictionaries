import { error, json } from '@sveltejs/kit'
import { send_email } from '../send-email'
import type { RequestHandler } from './$types'
import { dev } from '$app/environment'
import { ResponseCodes } from '$lib/constants'
import { getAdminSupabaseClient } from '$lib/supabase/admin'

export interface OTPEmailRequestBody {
  email: string
}

export interface OTPEmailResponseBody {
  result: 'success'
  otp?: string
}

export const POST: RequestHandler = async ({ request }) => {
  const { email } = await request.json() as OTPEmailRequestBody
  if (!email)
    error(ResponseCodes.BAD_REQUEST, 'No email provided')

  const admin_supabase = getAdminSupabaseClient()
  const { data, error: get_link_error } = await admin_supabase.auth.admin.generateLink({ email, type: 'magiclink' })
  if (get_link_error)
    error(500, get_link_error)

  if (dev)
    return json({ result: 'success', otp: data.properties.email_otp } satisfies OTPEmailResponseBody)

  try {
    await send_email({
      to: [{ email }],
      subject: 'Your One-Time Passcode for Living Dictionaries',
      body: `${data.properties.email_otp} is your one-time passcode for Living Dictionaries.`,
      type: 'text/plain',
    })

    return json({ result: 'success' } satisfies OTPEmailResponseBody)
  } catch (err) {
    console.error(`Error with email send request: ${err.message}`)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error with email send request: ${err.message}`)
  }
}
