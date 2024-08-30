import { error, json } from '@sveltejs/kit'
import type { IDictionary, IUser } from '@living-dictionaries/types'
import { getAdminRecipients } from '../addresses'
import newDictionary from '../html/newDictionary'
import { send_email } from '../send-email'
import { notifyAdminsOnNewDictionary } from './composeMessages'
import type { RequestHandler } from './$types'
import { ResponseCodes } from '$lib/constants'
import { decodeToken, getDb } from '$lib/server/firebase-admin'

export interface NewDictionaryRequestBody {
  auth_token: string
  dictionary: IDictionary & { id: string }
}

export const POST: RequestHandler = async ({ request }) => {
  const { auth_token, dictionary } = await request.json() as NewDictionaryRequestBody

  if (!dictionary.id)
    error(ResponseCodes.BAD_REQUEST, { message: 'No dictionary id found in request' })

  const decodedToken = await decodeToken(auth_token)
  if (!decodedToken?.uid)
    error(ResponseCodes.UNAUTHORIZED, { message: 'Unauthorized' })
  if (dictionary.createdBy !== decodedToken.uid)
    error(ResponseCodes.BAD_REQUEST, { message: 'CreatedBy is does not matched user id' })

  try {
    const db = getDb()
    const userSnap = await db.doc(`users/${decodedToken.uid}`).get()
    const user = userSnap.data() as IUser

    await send_email({
      to: [{ email: user.email }],
      subject: 'New Living Dictionary Created',
      type: 'text/html',
      body: newDictionary(dictionary.name, dictionary.id),
    })

    await send_email({
      to: getAdminRecipients(decodedToken.email),
      subject: `Living Dictionary created: ${dictionary.name}`,
      type: 'text/plain',
      body: notifyAdminsOnNewDictionary(dictionary, user),
    })

    return json('success')
  } catch (err) {
    console.error(`Error with email send request: ${err.message}`)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error with email send request: ${err.message}`)
  }
}
