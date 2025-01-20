import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { error, json } from '@sveltejs/kit'
import { firebaseConfig } from 'sveltefirets'
import { check_can_edit } from '$api/db/check-permission'
import { ResponseCodes } from '$lib/constants'
import { GCLOUD_MEDIA_BUCKET_S3 } from '$lib/server/gcloud'
import { decodeToken } from '$lib/server/firebase-admin'

export interface UploadRequestBody {
  auth_token: string
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

export async function POST({ request }) {
  try {
    const { auth_token, folder, dictionary_id, file_name, file_type } = await request.json() as UploadRequestBody

    if (!auth_token)
      throw new Error('missing auth_token')

    const decoded_token = await decodeToken(auth_token)
    if (!decoded_token?.uid)
      throw new Error('No user id found in token')

    await check_can_edit(decoded_token.uid, dictionary_id)

    if (!folder)
      throw new Error('Missing folder')
    if (!file_name?.trim())
      throw new Error('Missing file_name')
    if (!file_type?.trim())
      throw new Error('Missing file_type')

    const bucket = firebaseConfig.storageBucket
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
    console.error(`Error creating dictionary: ${err.message}`)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error creating dictionary: ${err.message}`)
  }
}
