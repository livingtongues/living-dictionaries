import { error, json } from '@sveltejs/kit'
import { getSupportMessageRecipients } from '../addresses'
import { type Address, send_email } from '../send-email'
import type { RequestHandler } from './$types'
import { dev } from '$app/environment'
import { ResponseCodes } from '$lib/constants'
import { getAdminSupabaseClient } from '$lib/supabase/admin'

export interface RequestAccessBody {
  email: string
  message: string
  name: string
  url: string
  dictionaryId: string
  dictionaryName: string
}

async function get_manager_addresses(dictionary_id: string): Promise<Address[]> {
  const admin_supabase = getAdminSupabaseClient()

  const { data: managers, error: manager_error } = await admin_supabase.from('dictionary_roles')
    .select(`
      dictionary_id,
      user_id,
      role,
      profile:profiles_view (
        full_name,
        email
      )
      `)
    .eq('role', 'manager')
    .eq('dictionary_id', dictionary_id)
  if (manager_error) throw new Error(manager_error.message)

  return managers.map((manager) => {
    return {
      name: manager.profile.full_name,
      email: manager.profile.email,
    }
  })
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { email, message, name, url, dictionaryId, dictionaryName } = await request.json() as RequestAccessBody

    const managerAddresses = await get_manager_addresses(dictionaryId)
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
