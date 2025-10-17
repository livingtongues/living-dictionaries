import { json, error as kit_error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { ResponseCodes } from '$lib/constants'

export interface DeleteDictionaryRequestBody {
  dictionary_id: string
}

export const POST: RequestHandler = async ({ request, locals: { getSession } }) => {
  const { data: session_data, error: _error, supabase } = await getSession()
  if (_error || !session_data?.user)
    kit_error(ResponseCodes.UNAUTHORIZED, { message: _error.message || 'Unauthorized' })

  try {
    const { dictionary_id } = await request.json() as DeleteDictionaryRequestBody
    throw new Error(`Not implemented yet - trying to delete ${dictionary_id}`)

    // read from DB all media references and write that to a media to delete list
    // delete dictionary and all related fields from DB

    // move all related media from cloud storage normal to a deleted bucket (that will occasionally be cleaned)

    // const { data: saved_dictionary, error } = await supabase.from('dictionaries').delete().eq('id', dictionary_id).single()
    // if (error) {
    //   console.error({ error })
    //   throw new Error(error.message)
    // }

    return json(null)
  } catch (err) {
    console.error(`Error deleting dictionary: ${err.message}`)
    kit_error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error deleting dictionary: ${err.message}`)
  }
}
