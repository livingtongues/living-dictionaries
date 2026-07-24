import { error, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { verify_auth_dict_role } from '$lib/auth/verify-dict-role'
import { LARGE_VIDEO_REVIEW_BYTES, ResponseCodes } from '$lib/constants'
import { get_dictionary_by_url_or_id } from '$lib/db/server/get-dictionary'
import { parse_media_key } from '$lib/db/server/media-ledger'
import { store_video_thumbnail_in_background } from '$lib/server/video-thumbnails'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_shared_db } from '$lib/db/server/shared-db'
import { post_large_video_notification } from '$lib/server/chat/large-video-notifier'

/**
 * Fast-path video-thumbnail trigger. Browser video uploads presign straight to
 * R2, so the server never sees the bytes at upload time — the client fires this
 * (fire-and-forget) right after the video row saves. We re-fetch the object from
 * R2, extract a frame, and store the `_thumb.webp` sibling in the background, so
 * the response returns immediately. Failure is non-fatal: the weekly media-sweep
 * self-heal is the safety net and the UI falls back to the play-icon chip.
 */

export interface VideoGenerateThumbnailRequestBody {
  dictionary_id: string
  /** The uploaded video's R2 `storage_path` (`{dict}/video/{uuid}.{ext}`). */
  storage_path: string
  /** Present on current clients so large, successfully saved videos can be reviewed. */
  sense_id?: string
  file_size?: number
}

export interface VideoGenerateThumbnailResponseBody {
  accepted: boolean
}

export const POST: RequestHandler = async (event) => {
  const { dictionary_id, storage_path, sense_id, file_size } = await event.request.json() as VideoGenerateThumbnailRequestBody

  if (!dictionary_id?.trim())
    error(ResponseCodes.BAD_REQUEST, 'Missing dictionary_id')
  if (!storage_path?.trim())
    error(ResponseCodes.BAD_REQUEST, 'Missing storage_path')

  const dictionary = get_dictionary_by_url_or_id(dictionary_id)
  if (!dictionary)
    error(ResponseCodes.NOT_FOUND, 'dictionary not found')

  const auth = await verify_auth_dict_role(event, { dictionary, min_role: 'contributor' })

  const parsed = parse_media_key(storage_path)
  if (!parsed || parsed.media_type !== 'video' || parsed.is_variant || parsed.dict_id !== dictionary.id)
    error(ResponseCodes.BAD_REQUEST, 'storage_path must be a new-convention video object for this dictionary')

  store_video_thumbnail_in_background({ original_key: storage_path })
  const media_id = storage_path.match(/\/(?<media_id>[0-9a-f-]{36})\.[^/.]+$/)?.groups?.media_id
  if (sense_id && media_id && Number.isSafeInteger(file_size) && file_size > LARGE_VIDEO_REVIEW_BYTES) {
    post_large_video_notification({
      shared_db: get_shared_db(),
      dictionary,
      dict_db: get_dictionary_db(dictionary.id),
      cell_key: 'video:sense',
      owner_id: sense_id,
      media_id,
      size_bytes: file_size,
      actor_user_id: auth.user_id,
      base_url: event.url.origin,
    })
  }
  return json({ accepted: true } satisfies VideoGenerateThumbnailResponseBody)
}
