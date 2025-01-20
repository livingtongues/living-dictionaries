import { json, error as kit_error } from '@sveltejs/kit'
import type { Tables, TablesUpdate } from '@living-dictionaries/types'
import { check_manager } from '../check-permission'
import type { RequestHandler } from './$types'
import { decodeToken } from '$lib/server/firebase-admin'
import { getAdminSupabaseClient } from '$lib/supabase/admin'
import { ResponseCodes } from '$lib/constants'

export interface UpdateDictionaryRequestBody {
  auth_token: string
  dictionary: TablesUpdate<'dictionaries'>
}

export interface UpdateDictionaryResponseBody {
  saved_dictionary: Tables<'dictionaries'>
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { auth_token, dictionary } = await request.json() as UpdateDictionaryRequestBody

    const admin_supabase = getAdminSupabaseClient()

    if (!auth_token)
      throw new Error('missing auth_token')

    const decoded_token = await decodeToken(auth_token)
    if (!decoded_token?.uid)
      throw new Error('No user id found in token')

    await check_manager(decoded_token.uid, dictionary.id)

    const { data: user } = await admin_supabase.from('user_emails')
      .select('id')
      .eq('email', decoded_token.email!)
      .single()
    if (!user?.id)
      throw new Error('No user id found in database')

    const { data: saved_dictionary, error } = await admin_supabase.from('dictionaries').update({
      ...dictionary,
      updated_by: user.id,
    })
      .eq('id', dictionary.id)
      .select().single()
    if (error) {
      console.error({ error })
      throw new Error(error.message)
    }

    return json({ saved_dictionary } satisfies UpdateDictionaryResponseBody)
  } catch (err) {
    console.error(`Error creating dictionary: ${err.message}`)
    kit_error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error creating dictionary: ${err.message}`)
  }
}
