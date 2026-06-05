import { error, json } from '@sveltejs/kit'
import { getAdminRecipients } from '../addresses'
import { send_email } from '../send-email'
import type { RequestHandler } from './$types'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'

export interface InviteRequestBody {
  dictionary_id: string
  role: 'manager' | 'contributor'
  target_email: string
  origin: string
}

export const POST: RequestHandler = async (event) => {
  const { user_id, email: inviter_email, name } = await verify_auth(event)
  if (!inviter_email)
    error(ResponseCodes.BAD_REQUEST, 'inviter must have an email on file')

  try {
    const data = await event.request.json() as InviteRequestBody
    const { role, dictionary_id, target_email, origin } = data

    const db = get_shared_db()

    const dictionary = db.prepare('SELECT name FROM dictionaries WHERE id = ?').get(dictionary_id) as { name: string } | undefined
    if (!dictionary)
      error(ResponseCodes.NOT_FOUND, 'Dictionary not found')

    const invite_id = crypto.randomUUID()
    const now = new Date().toISOString()
    db.prepare(`
      INSERT INTO invites
        (id, dictionary_id, inviter_user_id, inviter_email, target_email, role, status, dirty, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'queued', 1, ?, ?)
    `).run(invite_id, dictionary_id, user_id, inviter_email, target_email.trim().toLowerCase(), role, now, now)

    const roleMessage
      = role === 'manager'
        ? 'manager'
        : 'contributor, which allows you to add and edit entries'

    const inviter_name_or_email = name || inviter_email

    await send_email({
      to: [{ email: target_email }],
      reply_to: { email: inviter_email },
      subject: `${inviter_name_or_email} has invited you to contribute to the ${dictionary.name} Living Dictionary`,
      type: 'text/plain',
      body: `Hello,

${inviter_name_or_email} has invited you to work on the ${dictionary.name} Living Dictionary as a ${roleMessage}. If you would like to help with this dictionary, then open this link: ${origin}/${dictionary_id}/invite/${invite_id} to  access the dictionary.

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
    Our automatic function

    https://livingdictionaries.app`,
      })
    }

    db.prepare(`UPDATE invites SET status = 'sent', dirty = 1, updated_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), invite_id)

    return json('success')
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err)
      throw err
    console.error(`Error with email send request: ${(err as Error).message}`)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error with email send request: ${(err as Error).message}`)
  }
}
