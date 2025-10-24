import { json, error as kit_error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { ResponseCodes } from '$lib/constants'
import { getAdminSupabaseClient } from '$lib/supabase/admin'

export interface DeleteDictionaryRequestBody {
  dictionary_id: string
}

export const POST: RequestHandler = async ({ request, locals: { getSession } }) => {
  const { data: session_data, error: _error, supabase } = await getSession()
  if (_error || !session_data?.user)
    kit_error(ResponseCodes.UNAUTHORIZED, { message: _error.message || 'Unauthorized' })

  // check user.app_metadata.admin > 0
  const is_admin = session_data.user.app_metadata?.admin
  if (!is_admin)
    kit_error(ResponseCodes.FORBIDDEN, { message: 'Forbidden - admin access required' })

  try {
    const { dictionary_id } = await request.json() as DeleteDictionaryRequestBody

    const admin_supabase = getAdminSupabaseClient()

    const { data: audio_entries, error: audio_error } = await admin_supabase.from('audio').select('storage_path').eq('dictionary_id', dictionary_id)

    if (audio_error) {
      console.error({ audio_error })
      kit_error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error fetching audio entries: ${audio_error.message}`)
    }

    const { data: photo_entries, error: photo_error } = await admin_supabase.from('photos').select('storage_path').eq('dictionary_id', dictionary_id)
    if (photo_error) {
      console.error({ photo_error })
      kit_error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error fetching photo entries: ${photo_error.message}`)
    }

    const { data: video_entries, error: video_error } = await admin_supabase.from('videos').select('storage_path').eq('dictionary_id', dictionary_id)

    if (video_error) {
      console.error({ video_error })
      kit_error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error fetching video entries: ${video_error.message}`)
    }

    const storage_paths_to_delete = [
      ...(audio_entries?.map(entry => entry.storage_path) || []),
      ...(photo_entries?.map(entry => entry.storage_path) || []),
      ...(video_entries?.map(entry => entry.storage_path) || []),
    ]

    const { error: media_to_delete_error } = await admin_supabase.from('media_to_delete').insert(storage_paths_to_delete.map(storage_path => ({
      dictionary_id,
      storage_path,
      deleted_at: new Date().toISOString(),
    })))

    if (media_to_delete_error) {
      console.error({ media_to_delete_error })
      kit_error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error inserting into media_to_delete: ${media_to_delete_error.message}`)
    }

    const { error } = await supabase.from('dictionaries').delete().eq('id', dictionary_id).single()
    if (error) {
      console.error({ error })
      throw new Error(error.message)
    }

    return json(`Dictionary ${dictionary_id} deleted successfully`)
  } catch (err) {
    console.error(`Error deleting dictionary: ${err.message}`)
    kit_error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error deleting dictionary: ${err.message}`)
  }
}
