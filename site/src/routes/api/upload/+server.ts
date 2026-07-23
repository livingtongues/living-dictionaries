import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { error, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { verify_auth_dict_role } from '$lib/auth/verify-dict-role'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_by_url_or_id } from '$lib/db/server/get-dictionary'
import { gcs_is_configured, get_gcs } from '$lib/server/gcloud'
import { get_r2_media, r2_media_is_configured } from '$lib/server/r2-media'
import { log_server_event } from '$lib/server/log-server-event'
import { record_media_object_by_key } from '$lib/db/server/media-ledger'
import { build_r2_media_key, extract_media_extension } from '$lib/utils/media-path'

export interface UploadRequestBody {
  /** legacy GCS flow only (stale clients) — new-code paths omit it */
  folder?: string
  dictionary_id: string
  file_name: string
  file_type: string
  /**
   * Audio/video land in the R2 media bucket on the new key convention
   * `{dict_id}/{kind}/{media_id}.{ext}` — the client mints the media row uuid
   * BEFORE upload and inserts the row with that same id. Photos omit this and
   * keep the legacy GCS `folder` flow until Phase 2.
   */
  r2_media?: { kind: 'audio' | 'video', media_id: string }
  /** declared byte size — seeds the media ledger at presign time (trued-up by the sweep) */
  file_size?: number
}

export interface UploadResponseBody {
  presigned_upload_url: string
  bucket: string
  object_key: string
  item_id: string
  /** DEV-only: bytes go to the local `/api/dev-media` store, not GCS/R2. Images skip the serving-url fetch. */
  dev_mock?: boolean
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export const POST: RequestHandler = async (event) => {
  const { folder, dictionary_id, file_name, file_type, r2_media, file_size } = await event.request.json() as UploadRequestBody

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

  if (r2_media) {
    if (r2_media.kind !== 'audio' && r2_media.kind !== 'video')
      error(ResponseCodes.BAD_REQUEST, 'r2_media.kind must be audio or video')
    if (!UUID_REGEX.test(r2_media.media_id ?? ''))
      error(ResponseCodes.BAD_REQUEST, 'r2_media.media_id must be a uuid')
    // Key is built from the CANONICAL dictionary id (the caller may have passed a slug).
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
        CacheControl: 'public, max-age=31536000, immutable',
      }), { expiresIn: 60 })
      // Ledger seed with the DECLARED size — an abandoned PUT leaves a ledger row
      // with no object; the weekly sweep reconciles both cases.
      if (Number.isFinite(file_size) && file_size > 0)
        record_media_object_by_key({ key: object_key, bytes: file_size })
      return json({ presigned_upload_url, bucket, object_key, item_id: r2_media.media_id } satisfies UploadResponseBody)
    } catch (err) {
      console.error(`Error creating R2 upload URL: ${err.message}`)
      log_server_event({ level: 'error', message: 'upload_presign_failed', error: err, context: { dictionary_id, kind: r2_media.kind, file_type } })
      error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error creating upload URL: ${err.message}`)
    }
  }

  // Legacy GCS flow — photos (hero images, partner logos, sense photos) until Phase 2.
  if (!folder?.trim())
    error(ResponseCodes.BAD_REQUEST, 'Missing folder')

  if (!gcs_is_configured()) {
    // Dev media mock: no bucket configured locally — hand the client a PUT url to
    // the local `/api/dev-media` store so the upload→save→sync→render path works
    // end-to-end (bytes are kept locally + served back). Prod-without-creds keeps
    // the dormant 503.
    if (import.meta.env.DEV) {
      const extension = file_name.split('.').pop()
      const item_id = Date.now().toString()
      const object_key = `${folder}/${item_id}.${extension}`
      return json({
        presigned_upload_url: `/api/dev-media/${object_key}`,
        bucket: '',
        object_key,
        item_id,
        dev_mock: true,
      } satisfies UploadResponseBody)
    }
    error(ResponseCodes.SERVICE_UNAVAILABLE, 'Media uploads are not configured (missing GCS credentials)')
  }

  try {
    const { client, bucket } = get_gcs()
    const extension = file_name.split('.').pop()
    const item_id = Date.now().toString()
    const object_key = `${folder}/${item_id}.${extension}`

    const presigned_upload_url = await getSignedUrl(client, new PutObjectCommand({
      Bucket: bucket,
      Key: object_key,
      ContentType: file_type,
      ACL: 'public-read',
    }), {
      expiresIn: 60,
    })

    return json({ presigned_upload_url, bucket, object_key, item_id } satisfies UploadResponseBody)
  } catch (err) {
    console.error(`Error creating upload URL: ${err.message}`)
    log_server_event({ level: 'error', message: 'upload_presign_failed', error: err, context: { dictionary_id, folder, file_type } })
    error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error creating upload URL: ${err.message}`)
  }
}
