import { error, json } from '@sveltejs/kit'
import { getSupportMessageRecipients } from '../addresses'
import { send_email } from '../send-email'
import type { Address } from '../send-email'
import type { RequestHandler } from './$types'
import { dev } from '$app/environment'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'

export interface RequestAccessBody {
  email: string
  message: string
  name: string
  url: string
  dictionaryId: string
  dictionaryName: string
}

function get_manager_addresses(dictionary_id: string): Address[] {
  const db = get_shared_db()
  const managers = db.prepare(`
    SELECT users.name AS name, users.email AS email
    FROM dictionary_roles
    LEFT JOIN users ON users.id = dictionary_roles.user_id
    WHERE dictionary_roles.role = 'manager' AND dictionary_roles.dictionary_id = ?
  `).all(dictionary_id) as { name: string | null, email: string | null }[]

  return managers
    .filter(manager => !!manager.email)
    .map(manager => ({ name: manager.name ?? undefined, email: manager.email as string }))
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { email, message, name, url, dictionaryId, dictionaryName } = await request.json() as RequestAccessBody

    const managerAddresses = get_manager_addresses(dictionaryId)
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
