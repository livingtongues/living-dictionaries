import { error, json } from '@sveltejs/kit'
import type { IInvite, IUser } from '@living-dictionaries/types'
import { getAdminRecipients } from '../addresses'
import { send_email } from '../send-email'
import type { RequestHandler } from './$types'
import { decodeToken, getDb } from '$lib/server/firebase-admin'
import { ResponseCodes } from '$lib/constants'

export interface InviteRequestBody {
  auth_token: string
  dictionaryId: string
  invite: IInvite
}

export const POST: RequestHandler = async ({ request }) => {
  const { auth_token, dictionaryId, invite } = await request.json() as InviteRequestBody
  const { dictionaryName, inviterName, role, targetEmail, inviterEmail } = invite

  const decodedToken = await decodeToken(auth_token)
  if (!decodedToken?.uid)
    error(ResponseCodes.UNAUTHORIZED, { message: 'Unauthorized' })
  if (inviterEmail !== decodedToken.email)
    error(ResponseCodes.BAD_REQUEST, { message: 'Requesting from incorrect account' })

  const db = getDb()

  const checkForPermission = async () => {
    const dictionaryManagers = await db.collection(`dictionaries/${dictionaryId}/managers`).get()
    const isDictionaryManager = dictionaryManagers.docs.some(({ id }) => id === decodedToken.uid)
    if (isDictionaryManager) return true

    const userSnap = await db.doc(`users/${decodedToken.uid}`).get()
    const { roles } = userSnap.data() as IUser
    if (roles?.admin) return true

    error(ResponseCodes.BAD_REQUEST, { message: 'Is not a manager of this dictionary.' })
  }
  await checkForPermission()

  const inviteRef = await db.collection(`dictionaries/${dictionaryId}/invites`).add(invite)

  const roleMessage
    = role === 'manager'
      ? 'manager'
      : 'contributor, which allows you to add and edit entries'

  try {
    await send_email({
      to: [{ email: targetEmail }],
      reply_to: { email: inviterEmail },
      subject: `${inviterName} has invited you to contribute to the ${dictionaryName} Living Dictionary`,
      type: 'text/plain',
      body: `Hello,
  
${inviterName} has invited you to work on the ${dictionaryName} Living Dictionary as a ${roleMessage}. If you would like to help with this dictionary, then open this link: https://livingdictionaries.app/${dictionaryId}/invite/${inviteRef.id} to  access the dictionary.

If you have any questions for ${inviterName}, send an email to ${inviterEmail} or just reply to this email.

Thank you,
Living Tongues Institute for Endangered Languages

https://livingtongues.org (Living Tongues Homepage)
https://livingdictionaries.app (Living Dictionaries website)`,
    })

    const adminRecipients = getAdminRecipients(inviterEmail)
    if (!adminRecipients.find(({ email }) => email === inviterEmail)) {
      await send_email({
        to: adminRecipients,
        reply_to: { email: inviterEmail },
        subject: `${inviterName} has invited ${targetEmail} to contribute to the ${dictionaryName} Living Dictionary`,
        type: 'text/plain',
        body: `Hello Admins,
${inviterName} has invited ${targetEmail} to work on the ${dictionaryName} Living Dictionary as a ${roleMessage}.

Dictionary URL: https://livingdictionaries.app/${dictionaryId}
        
If you have any questions for ${inviterName}, just reply to this email.

Thanks,
Our automatic Vercel function

https://livingdictionaries.app`,
      })
    }

    await inviteRef.update({ status: 'sent' })

    return json('success')
  } catch (err) {
    console.error(`Error with email send request: ${err.message}`)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error with email send request: ${err.message}`)
  }
}
