import type { IHelper, IUser } from '@living-dictionaries/types'
import { error, json } from '@sveltejs/kit'
import { getSupportMessageRecipients } from '../addresses'
import { type Address, send_email } from '../send-email'
import type { RequestHandler } from './$types'
import { dev } from '$app/environment'
import { getDb } from '$lib/server/firebase-admin'
import { ResponseCodes } from '$lib/constants'

export interface RequestAccessBody {
  email: string
  message: string
  name: string
  url: string
  dictionaryId: string
  dictionaryName: string
}

async function getManagerAddresses(dictionaryId: string): Promise<Address[]> {
  const db = getDb()
  const managers = (await db.collection(`dictionaries/${dictionaryId}/managers`).get()).docs.map(doc => doc.data() as IHelper)
  const userPromises = managers.map((manager) => {
    return db.doc(`users/${manager.id}`).get()
  })
  const users = (await Promise.all(userPromises)).map(doc => doc.data() as IUser)
  return users.map((user) => {
    return {
      name: user.displayName,
      email: user.email,
    }
  })
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { email, message, name, url, dictionaryId, dictionaryName } = await request.json() as RequestAccessBody

    const managerAddresses = await getManagerAddresses(dictionaryId)
    await send_email({
      to: [...getSupportMessageRecipients({ dev }), ...managerAddresses],
      reply_to: { email },
      subject: `${dictionaryName} Living Dictionary: ${email} requests editing access`,
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
