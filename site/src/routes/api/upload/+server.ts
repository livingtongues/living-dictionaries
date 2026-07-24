import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { error, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { verify_auth_dict_role } from '$lib/auth/verify-dict-role'
import { MAX_AUDIO_UPLOAD_BYTES, MAX_VIDEO_UPLOAD_BYTES, ResponseCodes } from '$lib/constants'
import { get_dictionary_by_url_or_id } from '$lib/db/server/get-dictionary'
import { get_r2_media, r2_media_is_configured } from '$lib/server/r2-media'
import { log_server_event } from '$lib/server/log-server-event'
import { record_media_object_by_key } from '$lib/db/server/media-ledger'
import { build_r2_media_key, extract_media_extension } from '$lib/utils/media-path'

export interface UploadRequestBody {
  dictionary_id: string
  file_name: string
  file_type: string
  /** The client mints the media row uuid before uploading. Photos use `/api/photo-upload`. */
  r2_media?: { kind: 'audio' | 'video', media_id: string }
  /** declared byte size — seeds the media ledger at presign time (trued-up by the sweep) */
  file_size: number
}

export interface UploadResponseBody {
  presigned_upload_url: string
  bucket: string
  object_key: string
  item_id: string
  /** DEV-only: bytes go to the local `/api/dev-media` store, not R2. */
  dev_mock?: boolean
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export const POST: RequestHandler = async (event) => {
  const { dictionary_id, file_name, file_type, r2_media, file_size } = await event.request.json() as UploadRequestBody

  if (!dictionary_id?.trim())
    error(ResponseCodes.BAD_REQUEST, 'Missing dictionary_id')

  const dictionary = get_dictionary_by_url_or_id(dictionary_id)
  if (!dictionary)
    error(ResponseCodes.NOT_FOUND, 'dictionary not found')

  // Contributor+ (or admin) on this dictionary — re-checked server-side every
  // upload. Contributors are LD's editing tier (client `can_edit` includes them).
  await verify_auth_dict_role(event, { dictionary, min_role: 'contributor' })

  if (!file_name?.trim())
    error(ResponseCodes.BAD_REQUEST, 'Missing file_name')
  if (!file_type?.trim())
    error(ResponseCodes.BAD_REQUEST, 'Missing file_type')

  if (!r2_media)
    error(ResponseCodes.GONE, 'This upload method has been retired. Reload Living Dictionaries and try again.')
  if (r2_media.kind !== 'audio' && r2_media.kind !== 'video')
    error(ResponseCodes.BAD_REQUEST, 'r2_media.kind must be audio or video')
  if (!UUID_REGEX.test(r2_media.media_id ?? ''))
    error(ResponseCodes.BAD_REQUEST, 'r2_media.media_id must be a uuid')
  if (!Number.isSafeInteger(file_size) || file_size <= 0)
    error(ResponseCodes.BAD_REQUEST, 'file_size must be a positive integer')
  const max_bytes = r2_media.kind === 'video' ? MAX_VIDEO_UPLOAD_BYTES : MAX_AUDIO_UPLOAD_BYTES
  if (file_size > max_bytes)
    error(ResponseCodes.PAYLOAD_TOO_LARGE, `${r2_media.kind === 'video' ? 'Video' : 'Audio'} exceeds the ${max_bytes / 1024 / 1024}MB upload limit`)
  const object_key = build_r2_media_key({
    dict_id: dictionary.id,
    kind: r2_media.kind,
    media_id: r2_media.media_id,
    extension: extract_media_extension(file_name),
  })

  if (!r2_media_is_configured()) {
    if (import.meta.env.DEV) {
      return json({
        presigned_upload_url: `/api/dev-media/${object_key}`,
        bucket: '',
        object_key,
        item_id: r2_media.media_id,
        dev_mock: true,
      } satisfies UploadResponseBody)
    }
    error(ResponseCodes.SERVICE_UNAVAILABLE, 'Media uploads are not configured (missing R2 credentials)')
  }

  try {
    const { client, bucket } = get_r2_media()
    const presigned_upload_url = await getSignedUrl(client, new PutObjectCommand({
      Bucket: bucket,
      Key: object_key,
      ContentType: file_type,
      ContentLength: file_size,
      CacheControl: 'public, max-age=31536000, immutable',
    }), { expiresIn: 60 })
    record_media_object_by_key({ key: object_key, bytes: file_size })
    return json({ presigned_upload_url, bucket, object_key, item_id: r2_media.media_id } satisfies UploadResponseBody)
  } catch (err) {
    console.error(`Error creating R2 upload URL: ${err.message}`)
    log_server_event({ level: 'error', message: 'upload_presign_failed', error: err, context: { dictionary_id, kind: r2_media.kind, file_type } })
    error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error creating upload URL: ${err.message}`)
  }
}
