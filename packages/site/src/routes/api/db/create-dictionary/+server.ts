import { json, error as kit_error } from '@sveltejs/kit'
import type { IUser, TablesInsert } from '@living-dictionaries/types'
import type { RequestHandler } from './$types'
import { decodeToken } from '$lib/server/firebase-admin'
import { getAdminSupabaseClient } from '$lib/supabase/admin'
import { ResponseCodes } from '$lib/constants'
import { send_dictionary_emails } from '$api/email/new_dictionary/dictionary-emails'

export interface CreateDictionaryRequestBody {
  auth_token: string
  dictionary: Omit<TablesInsert<'dictionaries'>, 'created_by' | 'updated_by'>
  fb_user: IUser
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { auth_token, dictionary, fb_user } = await request.json() as CreateDictionaryRequestBody

    const admin_supabase = getAdminSupabaseClient()

    if (!auth_token)
      throw new Error('missing auth_token')

    const decoded_token = await decodeToken(auth_token)
    if (!decoded_token?.uid)
      throw new Error('No user id found in token')

    const { data: user } = await admin_supabase.from('user_emails')
      .select('id')
      .eq('email', decoded_token.email!)
      .single()
    if (!user?.id)
      throw new Error('No user id found in database')

    const { data: saved_dictionary, error } = await admin_supabase.from('dictionaries').insert({
      ...dictionary,
      created_by: user.id,
      updated_by: user.id,
    }).select().single()
    if (error) {
      console.error({ error })
      throw new Error(error.message)
    }

    await send_dictionary_emails(saved_dictionary, fb_user)

    return json(null)
  } catch (err) {
    console.error(`Error creating dictionary: ${err.message}`)
    kit_error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error creating dictionary: ${err.message}`)
  }
}
