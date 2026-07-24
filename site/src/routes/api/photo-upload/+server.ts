import { error, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { verify_auth_dict_role } from '$lib/auth/verify-dict-role'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_by_url_or_id } from '$lib/db/server/get-dictionary'
import { record_media_object_by_key } from '$lib/db/server/media-ledger'
import { MediaStorageNotConfiguredError, store_media_bytes } from '$lib/server/media-storage'
import { store_photo_variants_in_background } from '$lib/server/photo-variants'
import { extract_photo_exif } from '$lib/server/photo-exif'
import { transcode_image_to_jpeg } from '$lib/server/photo-transcode'
import { log_server_event } from '$lib/server/log-server-event'
import { is_heic_bytes, validate_media_bytes } from '$lib/api/v1/validate-media-bytes'
import { normalize_photo_exif } from '$lib/media/photo-coords'
import type { PhotoExif } from '$lib/media/photo-coords'
import { build_r2_media_key, extract_media_extension } from '$lib/utils/media-path'

/**
 * Photo upload (Phase 2, replaces the presign + lh3 serving-url flow): the
 * browser POSTs the bytes here; we store the ORIGINAL on the R2 key convention
 * `{dict}/photo/{photo_row_uuid}.{ext}` and respond immediately (upload feels
 * presign-fast); the three WebP variants are generated + stored AFTER the
 * response, in-process (adapter-node keeps running; a crash in the gap is
 * self-healed by the media reconcile sweep). The client inserts the photo row
 * with the SAME pre-minted uuid and `serving_url: ''`.
 */

export interface PhotoUploadResponseBody {
  storage_path: string
  /** EXIF-derived, village-level (2dp) — client-supplied fields win over a server read of the bytes. */
  latitude?: number
  longitude?: number
  taken_at?: string
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const TEN_MB = 10_485_760

export const POST: RequestHandler = async (event) => {
  const form = await event.request.formData().catch(() => null)
  if (!form)
    error(ResponseCodes.BAD_REQUEST, 'Expected multipart form data')

  const dictionary_id = form.get('dictionary_id')
  const photo_id = form.get('photo_id')
  const file = form.get('file')

  if (typeof dictionary_id !== 'string' || !dictionary_id.trim())
    error(ResponseCodes.BAD_REQUEST, 'Missing dictionary_id')
  if (typeof photo_id !== 'string' || !UUID_REGEX.test(photo_id))
    error(ResponseCodes.BAD_REQUEST, 'photo_id must be a uuid')
  if (!(file instanceof File))
    error(ResponseCodes.BAD_REQUEST, 'Missing file')
  // Empty type is allowed (some pickers omit it) — the magic-byte validation below is the real gate.
  if ((file.type && file.type.split('/')[0] !== 'image') || file.type === 'image/svg+xml')
    error(ResponseCodes.BAD_REQUEST, 'File must be a raster image')
  if (file.size > TEN_MB)
    error(ResponseCodes.BAD_REQUEST, 'Image must be smaller than 10MB')

  const dictionary = get_dictionary_by_url_or_id(dictionary_id)
  if (!dictionary)
    error(ResponseCodes.NOT_FOUND, 'dictionary not found')
  await verify_auth_dict_role(event, { dictionary, min_role: 'contributor' })

  let bytes = new Uint8Array(await file.arrayBuffer())
  let file_name = file.name
  let file_type = file.type

  // EXIF read BEFORE any transcode (transcoding strips metadata). The client
  // extracts from the ORIGINAL file pre-conversion and sends fields — those win;
  // a server read of the received bytes is the fallback (v1-less direct posts).
  const client_exif = normalize_photo_exif({
    latitude: number_field(form.get('latitude')),
    longitude: number_field(form.get('longitude')),
    taken_at: typeof form.get('taken_at') === 'string' ? form.get('taken_at') as string : null,
  })
  const exif: PhotoExif = { ...await extract_photo_exif(bytes), ...client_exif }

  // No-HEIC bucket policy: Safari converts client-side before upload, so this
  // net only catches a non-Safari browser holding a HEIC — try one transcode,
  // reject clearly if the decoder can't handle it (never store an undisplayable original).
  if (is_heic_bytes(bytes)) {
    const jpeg = await transcode_image_to_jpeg(bytes)
    if (!jpeg)
      error(ResponseCodes.UNSUPPORTED_MEDIA_TYPE, 'This HEIC photo could not be converted. Please convert it to JPEG (e.g. share/export it from your photos app) and try again.')
    bytes = new Uint8Array(jpeg)
    file_name = file_name.replace(/\.[^.]+$/, '.jpg')
    file_type = 'image/jpeg'
  } else {
    const validation = validate_media_bytes({ category: 'image', declared_type: file_type, bytes })
    if (!validation.ok)
      error(ResponseCodes.UNSUPPORTED_MEDIA_TYPE, validation.reason)
  }

  const storage_path = build_r2_media_key({
    dict_id: dictionary.id,
    kind: 'photo',
    media_id: photo_id,
    extension: extract_media_extension(file_name),
  })

  try {
    await store_media_bytes({ file_name, file_type, bytes, r2_key: storage_path })
  } catch (err) {
    if (err instanceof MediaStorageNotConfiguredError)
      error(ResponseCodes.SERVICE_UNAVAILABLE, err.message)
    console.error(`Photo upload failed: ${err.message}`)
    log_server_event({ level: 'error', message: 'photo_upload_failed', error: err, context: { dictionary_id, storage_path, bytes: file.size } })
    error(ResponseCodes.INTERNAL_SERVER_ERROR, `Photo upload failed: ${err.message}`)
  }

  record_media_object_by_key({ key: storage_path, bytes: bytes.length })
  store_photo_variants_in_background({ original_key: storage_path, bytes })

  return json({ storage_path, ...exif } satisfies PhotoUploadResponseBody)
}

function number_field(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string' || !value.trim())
    return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}
