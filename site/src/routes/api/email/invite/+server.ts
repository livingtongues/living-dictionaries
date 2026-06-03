import { error, json } from '@sveltejs/kit'
import type { TablesInsert } from '@living-dictionaries/types'
import { getAdminRecipients } from '../addresses'
import { send_email } from '../send-email'
import type { RequestHandler } from './$types'
import { ResponseCodes } from '$lib/constants'

export type InviteRequestBody = Pick<TablesInsert<'invites'>, 'dictionary_id' | 'role' | 'target_email'> & {
  origin: string
}

export const POST: RequestHandler = async ({ request, locals: { getSession } }) => {
  const { data: session_data, error: _error, supabase } = await getSession()
  if (_error || !session_data?.user)
    error(ResponseCodes.UNAUTHORIZED, { message: _error.message || 'Unauthorized' })

  try {
    const data = await request.json() as InviteRequestBody
    const { role, dictionary_id, target_email, origin } = data

    const inviter_email = session_data.user.email
    const { data: invite, error: insert_invite_error } = await supabase.from('invites').insert({
      dictionary_id,
      role,
      target_email,
      inviter_email,
      status: 'queued',
    }).select().single()

    if (insert_invite_error)
      throw new Error(insert_invite_error.message)

    const roleMessage
    = role === 'manager'
      ? 'manager'
      : 'contributor, which allows you to add and edit entries'

    const { data: dictionary, error: dictionary_error } = await supabase.from('dictionaries').select('name').eq('id', dictionary_id).single()
    if (dictionary_error)
      throw new Error(dictionary_error.message)

    const inviter_name_or_email = session_data.user.user_metadata.full_name || session_data.user.email

    await send_email({
      to: [{ email: target_email }],
      reply_to: { email: inviter_email },
      subject: `${inviter_name_or_email} has invited you to contribute to the ${dictionary.name} Living Dictionary`,
      type: 'text/plain',
      body: `Hello,
  
${inviter_name_or_email} has invited you to work on the ${dictionary.name} Living Dictionary as a ${roleMessage}. If you would like to help with this dictionary, then open this link: ${origin}/${dictionary_id}/invite/${invite.id} to  access the dictionary.

If you have any questions for ${inviter_name_or_email}, send an email to ${inviter_email} or just reply to this email.

Thank you,
Living Tongues Institute for Endangered Languages

https://livingtongues.org (Living Tongues Homepage)
https://livingdictionaries.app (Living Dictionaries website)`,
    })

    const adminRecipients = getAdminRecipients(inviter_email)
    if (!adminRecipients.find(({ email }) => email === inviter_email)) {
      await send_email({
        to: adminRecipients,
        reply_to: { email: inviter_email },
        subject: `${inviter_name_or_email} has invited ${target_email} to contribute to the ${dictionary.name} Living Dictionary`,
        type: 'text/plain',
        body: `Hello Admins,
    ${inviter_name_or_email} has invited ${target_email} to work on the ${dictionary.name} Living Dictionary as a ${roleMessage}.

    Dictionary URL: https://livingdictionaries.app/${dictionary_id}

    If you have any questions for ${inviter_name_or_email}, just reply to this email.

    Thanks,
    Our automatic Vercel function

    https://livingdictionaries.app`,
      })
    }

    const { error: update_error } = await supabase.from('invites').update({ status: 'sent' }).eq('id', invite.id)
    if (update_error)
      throw new Error(update_error.message)

    return json('success')
  } catch (err) {
    console.error(`Error with email send request: ${err.message}`)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error with email send request: ${err.message}`)
  }
}
