import { error, json } from '@sveltejs/kit'
import { getAdminRecipients } from '../addresses'
import newUserWelcome from '../html/newUserWelcome'
import { send_email } from '../send-email'
import type { RequestHandler } from './$types'
import { ResponseCodes } from '$lib/constants'

export interface NewUserEmailRequestBody {
  // language: LanguageCode
}

export const POST: RequestHandler = async ({ locals: { getSession } }) => {
  const { data: session_data, error: _error, supabase } = await getSession()
  if (_error || !session_data?.user)
    error(ResponseCodes.UNAUTHORIZED, { message: _error.message || 'Unauthorized' })

  try {
    await send_email({
      to: [{ email: session_data.user.email }],
      subject: 'Thank you for creating a Living Dictionaries account!',
      type: 'text/html',
      body: newUserWelcome,
    })

    await send_email({
      to: getAdminRecipients(session_data.user.email),
      subject: `New Living Dictionaries user: ${session_data.user.email}`,
      type: 'text/plain',
      body: `Hey Admins,

${session_data.user.email} has just created a Living Dictionaries account, and we sent them an automatic welcome email.

~ Our automatic Vercel Function

https://livingdictionaries.app`,
    })

    const { error: updating_welcome_email_error } = await supabase.from('user_data').update({ welcome_email_sent: new Date().toISOString() }).eq('id', session_data.user.id)
    if (updating_welcome_email_error)
      console.error({ updating_welcome_email_error })

    return json({ result: 'success' })
  } catch (err) {
    console.error(`Error with welcome email send request: ${err.message}`)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error with welcome email send request: ${err.message}`)
  }
}
