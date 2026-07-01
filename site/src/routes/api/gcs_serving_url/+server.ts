import { error, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { fetch_serving_url, MediaStorageNotConfiguredError } from '$lib/server/media-storage'
import { log_server_event } from '$lib/server/log-server-event'

export interface GCSServingUrlRequestBody {
  storage_path: string
}

export interface GCSServingUrlResponseBody {
  serving_url: string
}

export const POST: RequestHandler = async (event) => {
  await verify_auth(event)

  const { storage_path } = await event.request.json() as GCSServingUrlRequestBody
  if (!storage_path?.trim())
    error(ResponseCodes.BAD_REQUEST, 'Missing storage_path')

  try {
    const serving_url = await fetch_serving_url({ storage_path })
    return json({ serving_url } satisfies GCSServingUrlResponseBody)
  } catch (err: any) {
    if (err instanceof MediaStorageNotConfiguredError)
      error(ResponseCodes.SERVICE_UNAVAILABLE, err.message)
    console.error(`Photo processing error when getting serving url: ${err.message}`)
    log_server_event({ level: 'error', message: 'gcs_serving_url_failed', error: err, context: { storage_path } })
    error(ResponseCodes.INTERNAL_SERVER_ERROR, `Photo processing error when getting serving url: ${err.message}`)
  }
}
