import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { error, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { verify_auth_dict_role } from '$lib/auth/verify-dict-role'
import { ResponseCodes } from '$lib/constants'
import { gcs_is_configured, get_gcs } from '$lib/server/gcloud'

export interface UploadRequestBody {
  folder: string
  dictionary_id: string
  file_name: string
  file_type: string
}

export interface UploadResponseBody {
  presigned_upload_url: string
  bucket: string
  object_key: string
  item_id: string
  /** DEV-only: bytes go to the local `/api/dev-media` store, not GCS. Images skip the serving-url fetch. */
  dev_mock?: boolean
}

export const POST: RequestHandler = async (event) => {
  const { folder, dictionary_id, file_name, file_type } = await event.request.json() as UploadRequestBody

  if (!dictionary_id?.trim())
    error(ResponseCodes.BAD_REQUEST, 'Missing dictionary_id')

  // Editor (or admin) on this dictionary — re-checked server-side every upload.
  await verify_auth_dict_role(event, dictionary_id, 'editor')

  if (!folder?.trim())
    error(ResponseCodes.BAD_REQUEST, 'Missing folder')
  if (!file_name?.trim())
    error(ResponseCodes.BAD_REQUEST, 'Missing file_name')
  if (!file_type?.trim())
    error(ResponseCodes.BAD_REQUEST, 'Missing file_type')

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
    error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error creating upload URL: ${err.message}`)
  }
}
