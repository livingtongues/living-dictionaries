import { error, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { PROCESS_IMAGE_URL } from '$env/static/private'
import { ResponseCodes } from '$lib/constants'

export interface GCSServingUrlRequestBody {
  storage_path: string
}

export interface GCSServingUrlResponseBody {
  serving_url: string
}

export const POST: RequestHandler = async ({ request, fetch, locals: { getSession } }) => {
  if (!PROCESS_IMAGE_URL)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, 'Missing PROCESS_IMAGE_URL')

  const { data: session_data, error: _error } = await getSession()
  if (_error || !session_data?.user)
    error(ResponseCodes.UNAUTHORIZED, { message: _error.message || 'Unauthorized' })

  const { storage_path } = await request.json() as GCSServingUrlRequestBody

  if (!storage_path)
    error(ResponseCodes.BAD_REQUEST, 'Missing storage_location')

  try {
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
