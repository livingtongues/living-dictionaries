import { error, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { verify_auth_dict_role } from '$lib/auth/verify-dict-role'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_by_url_or_id } from '$lib/db/server/get-dictionary'
import { store_audio_derivative_in_background } from '$lib/server/audio-derivative'
import { is_r2_media_path } from '$lib/utils/media-path'

export interface AudioGenerateDerivativeRequestBody { dictionary_id: string, storage_path: string, trim: boolean }
export interface AudioGenerateDerivativeResponseBody { queued: boolean }

export const POST: RequestHandler = async (event) => {
  const body = await event.request.json() as AudioGenerateDerivativeRequestBody
  const dictionary = get_dictionary_by_url_or_id(body.dictionary_id)
  if (!dictionary) error(ResponseCodes.NOT_FOUND, 'dictionary not found')
  await verify_auth_dict_role(event, { dictionary, min_role: 'contributor' })
  if (!is_r2_media_path(body.storage_path) || !body.storage_path.startsWith(`${dictionary.id}/audio/`))
    error(ResponseCodes.BAD_REQUEST, 'Invalid audio storage_path')
  return json({ queued: store_audio_derivative_in_background({ original_key: body.storage_path, trim: body.trim === true }) } satisfies AudioGenerateDerivativeResponseBody)
}
