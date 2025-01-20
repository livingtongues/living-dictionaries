import { error, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { PROCESS_IMAGE_URL } from '$env/static/private'
import { decodeToken } from '$lib/server/firebase-admin'
import { ResponseCodes } from '$lib/constants'

export interface GCSServingUrlRequestBody {
  auth_token: string
  storage_path: string
}

export interface GCSServingUrlResponseBody {
  serving_url: string
}

export const POST: RequestHandler = async ({ request, fetch }) => {
  if (!PROCESS_IMAGE_URL)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, 'Missing PROCESS_IMAGE_URL')

  const { auth_token, storage_path } = await request.json() as GCSServingUrlRequestBody

  if (!storage_path)
    error(ResponseCodes.BAD_REQUEST, 'Missing storage_location')

  try {
    const decodedToken = await decodeToken(auth_token)
    if (!decodedToken?.uid)
      throw new Error('No user id found in token')

    const processAndLocationUrl = `${PROCESS_IMAGE_URL}/${storage_path}`

    const result = await fetch(processAndLocationUrl)
    const url = await result.text()
    if (!url)
      throw new Error('No serving url returned')
    const serving_url_prefix = 'http://lh3.googleusercontent.com/'
    if (!url.startsWith(serving_url_prefix))
      throw new Error(`Unexpected serving url response: ${url}`)
    const serving_url = url.replace(serving_url_prefix, '').replace('\n', '')
    return json({ serving_url } satisfies GCSServingUrlResponseBody)
  } catch (err: any) {
    console.error(`Photo processing error when getting serving url: ${err.message}`)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, `Photo processing error when getting serving url: ${err.message}`)
  }
}
