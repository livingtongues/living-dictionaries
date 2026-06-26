import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { type RequestHandler, error, json } from '@sveltejs/kit'
import { check_can_edit } from '$api/db/check-permission'
import { ResponseCodes } from '$lib/constants'
import { GCLOUD_MEDIA_BUCKET_S3 } from '$lib/server/gcloud'
import { mode } from '$lib/supabase'

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
}

export const POST: RequestHandler = async ({ request, locals: { getSession } }) => {
  const { data: session_data, error: _error, supabase } = await getSession()
  if (_error || !session_data?.user)
    error(ResponseCodes.UNAUTHORIZED, { message: _error.message || 'Unauthorized' })

  try {
    const { folder, dictionary_id, file_name, file_type } = await request.json() as UploadRequestBody

    if (!session_data.user.app_metadata.admin) {
      await check_can_edit(supabase, dictionary_id)
    }

    if (!folder)
      throw new Error('Missing folder')
    if (!file_name?.trim())
      throw new Error('Missing file_name')
    if (!file_type?.trim())
      throw new Error('Missing file_type')

    const bucket = mode === 'development' ? 'talking-dictionaries-dev.appspot.com' : 'talking-dictionaries-alpha.appspot.com'
    const extension = file_name.split('.').pop()
    const item_id = Date.now().toString()
    const object_key = `${folder}/${item_id}.${extension}`

    const presigned_upload_url = await getSignedUrl(GCLOUD_MEDIA_BUCKET_S3, new PutObjectCommand({
      Bucket: bucket,
      Key: object_key,
      ContentType: file_type,
      ACL: 'public-read',
    }), {
      expiresIn: 60,
    })

    return json({ presigned_upload_url, bucket, object_key, item_id } satisfies UploadResponseBody)
  } catch (err) {
    console.error(`Error uploading: ${err.message}`)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error uploading: ${err.message}`)
  }
}
