import { error } from '@sveltejs/kit'
import { MAX_MEDIA_UPLOAD_BYTES, MEDIA_FETCH_TIMEOUT_MS, ResponseCodes } from '$lib/constants'

/**
 * Parse a v1 media POST that carries bytes EITHER as a multipart `file` field OR
 * as a JSON `{ url }` the server fetches. Non-file/url keys become `fields`
 * (metadata: id, speaker_id, source, photographer, videographer, hosted_url,
 * hosted_elsewhere, replace). A video may carry NO bytes (hosted link only) — then
 * `bytes` is null and the route decides whether that's valid. Throws 400 on a bad
 * body / url and 413 when bytes exceed {@link MAX_MEDIA_UPLOAD_BYTES}.
 */
export interface ParsedMediaRequest {
  bytes: Uint8Array | null
  file_name: string | null
  file_type: string | null
  fields: Record<string, unknown>
}

export async function parse_media_request(event: { request: Request }): Promise<ParsedMediaRequest> {
  const content_type = event.request.headers.get('content-type') || ''

  if (content_type.includes('multipart/form-data')) {
    const form = await event.request.formData()
    const fields: Record<string, unknown> = {}
    for (const [key, value] of form.entries()) {
      if (key !== 'file' && typeof value === 'string')
        fields[key] = value
    }
    const file = form.get('file')
    if (file && typeof file !== 'string') {
      const blob = file as File
      const bytes = new Uint8Array(await blob.arrayBuffer())
      assert_within_cap(bytes.byteLength)
      return { bytes, file_name: blob.name || 'upload', file_type: blob.type || 'application/octet-stream', fields }
    }
    return { bytes: null, file_name: null, file_type: null, fields }
  }

  const body = await event.request.json().catch(() => {
    error(ResponseCodes.BAD_REQUEST, 'Invalid JSON body')
  }) as Record<string, unknown>
  const { url, file: _file, ...fields } = body
  if (typeof url === 'string' && url.trim())
    return { ...(await fetch_remote_media(url.trim())), fields }
  return { bytes: null, file_name: null, file_type: null, fields }
}

function assert_within_cap(byte_length: number): void {
  if (byte_length > MAX_MEDIA_UPLOAD_BYTES)
    error(ResponseCodes.PAYLOAD_TOO_LARGE, `File exceeds the ${Math.round(MAX_MEDIA_UPLOAD_BYTES / 1024 / 1024)}MB limit; for large video use a hosted_elsewhere link`)
}

async function fetch_remote_media(url: string): Promise<{ bytes: Uint8Array, file_name: string, file_type: string }> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    error(ResponseCodes.BAD_REQUEST, `Invalid url: ${url}`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
    error(ResponseCodes.BAD_REQUEST, 'url must be http(s)')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), MEDIA_FETCH_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(url, { signal: controller.signal, redirect: 'follow' })
  } catch (err) {
    error(ResponseCodes.BAD_REQUEST, `Could not fetch url: ${(err as Error).message}`)
  } finally {
    clearTimeout(timeout)
  }
  if (!response.ok)
    error(ResponseCodes.BAD_REQUEST, `Fetching url returned ${response.status}`)

  const declared_length = Number(response.headers.get('content-length'))
  if (declared_length && declared_length > MAX_MEDIA_UPLOAD_BYTES)
    assert_within_cap(declared_length)

  const bytes = new Uint8Array(await response.arrayBuffer())
  assert_within_cap(bytes.byteLength)

  const file_type = (response.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim()
  const file_name = parsed.pathname.split('/').filter(Boolean).pop() || 'download'
  return { bytes, file_name, file_type }
}
