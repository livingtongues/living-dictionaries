import { error, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { verify_auth } from '$lib/auth/verify'
import { env } from '$env/dynamic/private'
import { ResponseCodes } from '$lib/constants'

export interface GCSServingUrlRequestBody {
  storage_path: string
}

export interface GCSServingUrlResponseBody {
  serving_url: string
}

const SERVING_URL_PREFIX = 'http://lh3.googleusercontent.com/'

export const POST: RequestHandler = async (event) => {
  await verify_auth(event)

  const { storage_path } = await event.request.json() as GCSServingUrlRequestBody
  if (!storage_path?.trim())
    error(ResponseCodes.BAD_REQUEST, 'Missing storage_path')

  if (!env.PROCESS_IMAGE_URL)
    error(ResponseCodes.SERVICE_UNAVAILABLE, 'Image serving-url service is not configured (missing PROCESS_IMAGE_URL)')

  try {
    const result = await fetch(`${env.PROCESS_IMAGE_URL}/${storage_path}`)
    const url = (await result.text()).trim()
    if (!url.startsWith(SERVING_URL_PREFIX))
      throw new Error(`Unexpected serving url response: ${url}`)
    const serving_url = url.replace(SERVING_URL_PREFIX, '')
    return json({ serving_url } satisfies GCSServingUrlResponseBody)
  } catch (err: any) {
    console.error(`Photo processing error when getting serving url: ${err.message}`)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, `Photo processing error when getting serving url: ${err.message}`)
  }
}
