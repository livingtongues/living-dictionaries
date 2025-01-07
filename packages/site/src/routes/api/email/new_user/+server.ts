import { error, json } from '@sveltejs/kit'
import type { IUser } from '@living-dictionaries/types'
import { getAdminRecipients } from '../addresses'
import newUserWelcome from '../html/newUserWelcome'
import { send_email } from '../send-email'
import { save_user_to_supabase } from './save-user-to-supabase'
import type { RequestHandler } from './$types'
import { ResponseCodes } from '$lib/constants'
import { decodeToken } from '$lib/server/firebase-admin'

export interface NewUserRequestBody {
  auth_token: string
  user: IUser
}

export const POST: RequestHandler = async ({ request }) => {
  const { auth_token, user } = await request.json() as NewUserRequestBody

  const decodedToken = await decodeToken(auth_token)
  if (!decodedToken?.uid)
    error(ResponseCodes.UNAUTHORIZED, { message: 'Unauthorized' })
  if (user.email !== decodedToken.email)
    error(ResponseCodes.BAD_REQUEST, { message: 'token email does not match user email' })

  try {
    await send_email({
      to: [{ email: user.email }],
      subject: 'Thank you for creating a Living Dictionaries account!',
      type: 'text/html',
      body: newUserWelcome,
    })

    const supabase_user_id = await save_user_to_supabase(user)
    console.info({ supabase_user_id })

    await send_email({
      to: getAdminRecipients(decodedToken.email),
      subject: `New Living Dictionaries user: ${user.displayName}`,
      type: 'text/plain',
      body: `Hey Admins,

${user.displayName} has just created a Living Dictionaries account, and we sent an automatic welcome email to ${user.email}

Thanks,
Our automatic Vercel Function

https://livingdictionaries.app`,
    })

    return json('success')
  } catch (err) {
    console.error(`Error with email send request: ${err.message}`)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error with email send request: ${err.message}`)
  }
}
