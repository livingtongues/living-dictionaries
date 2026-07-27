import type { RequestHandler } from './$types'
import type { FeaturedImage } from '$lib/db/schemas/shared.types'
import sharp from 'sharp'
import { parse_media_request } from '$lib/api/v1/media-request'
import { validate_media_bytes } from '$lib/api/v1/validate-media-bytes'
import { MAX_PHOTO_UPLOAD_BYTES, ResponseCodes } from '$lib/constants'
import { record_media_object_by_key } from '$lib/db/server/media-ledger'
import { update_dictionary_catalog } from '$lib/db/server/dictionary-catalog'
import { get_shared_db } from '$lib/db/server/shared-db'
import { load_v1_dictionary_context } from '$lib/db/server/v1-route-context'
import { MediaStorageNotConfiguredError, store_media_bytes } from '$lib/server/media-storage'
import { store_photo_variants_in_background } from '$lib/server/photo-variants'
import { log_server_event } from '$lib/server/log-server-event'
import { build_r2_media_key, extract_media_extension } from '$lib/utils/media-path'
import { error, json } from '@sveltejs/kit'

/**
 * The dictionary's cover photo — the hero image at the top of its home page.
 *
 * Not a `photos` row: the bytes are keyed like any photo (`{dict}/photo/{uuid}.{ext}`,
 * with the three WebP variants generated behind the response) but the reference
 * lives on the catalog row as `dictionaries.featured_image`, exactly as the human
 * hero uploader writes it (`routes/[dictionaryId]/home/hero-image.ts`). One call
 * uploads and sets it, matching the rest of the media API.
 */

export interface V1CoverImageResponseBody {
  featured_image: FeaturedImage | null
}

async function read_dimensions(bytes: Uint8Array): Promise<{ width?: number, height?: number }> {
  try {
    const { width, height } = await sharp(bytes).metadata()
    return { width, height }
  } catch {
    return {} // a cover without dimensions still renders; never fail the upload over this
  }
}

/**
 * POST …/cover-image — multipart `file`, or JSON `{ "url": "https://…" }` and we
 * fetch it. Replaces any existing cover (there is only ever one).
 */
export const POST: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })

  const parsed = await parse_media_request(event, { max_bytes: MAX_PHOTO_UPLOAD_BYTES, medium: 'photo' })
  if (!parsed.bytes)
    error(ResponseCodes.BAD_REQUEST, 'Provide an image as multipart `file` or a JSON body with `url`')

  const check = validate_media_bytes({ category: 'image', declared_type: parsed.file_type, bytes: parsed.bytes })
  if (!check.ok)
    error(ResponseCodes.UNSUPPORTED_MEDIA_TYPE, check.reason ?? 'Unsupported media type')

  const r2_key = build_r2_media_key({
    dict_id: dictionary.id,
    kind: 'photo',
    media_id: crypto.randomUUID(),
    extension: extract_media_extension(parsed.file_name ?? ''),
  })

  let stored
  try {
    stored = await store_media_bytes({ file_type: parsed.file_type ?? 'image/jpeg', bytes: parsed.bytes, r2_key })
  } catch (err) {
    if (err instanceof MediaStorageNotConfiguredError)
      error(ResponseCodes.SERVICE_UNAVAILABLE, err.message)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, `Upload failed: ${(err as Error).message}`)
  }
  record_media_object_by_key({ key: stored.storage_path, bytes: parsed.bytes.length })

  const featured_image: FeaturedImage = { storage_path: stored.storage_path, ...(await read_dimensions(parsed.bytes)) }
  update_dictionary_catalog({
    db: get_shared_db(),
    dictionary_id: dictionary.id,
    fields: { featured_image },
    user_id: access.user_id,
    allowed: new Set(['featured_image']),
  })

  store_photo_variants_in_background({ original_key: stored.storage_path, bytes: parsed.bytes })

  log_server_event({ level: 'info', message: 'v1_cover_image_set', user_id: access.user_id, context: { dictionary_id: dictionary.id, storage_path: stored.storage_path, via: access.via } })

  return json({ featured_image } satisfies V1CoverImageResponseBody)
}

/** DELETE …/cover-image — clear it. The bytes stay in R2 until the media sweep collects them. */
export const DELETE: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })

  update_dictionary_catalog({
    db: get_shared_db(),
    dictionary_id: dictionary.id,
    fields: { featured_image: null },
    user_id: access.user_id,
    allowed: new Set(['featured_image']),
  })

  log_server_event({ level: 'info', message: 'v1_cover_image_cleared', user_id: access.user_id, context: { dictionary_id: dictionary.id, via: access.via } })

  return json({ featured_image: null } satisfies V1CoverImageResponseBody)
}
