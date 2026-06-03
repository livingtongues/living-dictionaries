import { json, error as kit_error } from '@sveltejs/kit'
import type { TablesInsert } from '@living-dictionaries/types'
import type { RequestHandler } from './$types'
import { ResponseCodes } from '$lib/constants'
import { send_dictionary_emails } from '$api/email/new_dictionary/dictionary-emails'

export interface CreateDictionaryRequestBody {
  dictionary: TablesInsert<'dictionaries'>
}

export const POST: RequestHandler = async ({ request, locals: { getSession } }) => {
  const { data: session_data, error: _error, supabase } = await getSession()
  if (_error || !session_data?.user)
    kit_error(ResponseCodes.UNAUTHORIZED, { message: _error.message || 'Unauthorized' })

  try {
    const { dictionary } = await request.json() as CreateDictionaryRequestBody

    const { data: saved_dictionary, error } = await supabase.from('dictionaries').insert(dictionary).select().single()
    if (error) {
      console.error({ error })
      throw new Error(error.message)
    }

    await send_dictionary_emails(saved_dictionary, session_data.user.email)

    return json(null)
  } catch (err) {
    console.error(`Error creating dictionary: ${err.message}`)
    kit_error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error creating dictionary: ${err.message}`)
  }
}
