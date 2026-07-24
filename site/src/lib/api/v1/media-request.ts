import { error } from '@sveltejs/kit'
import { MEDIA_FETCH_TIMEOUT_MS, ResponseCodes } from '$lib/constants'

/**
 * Parse a v1 media POST that carries bytes EITHER as a multipart `file` field OR
 * as a JSON `{ url }` the server fetches. Non-file/url keys become `fields`
 * (metadata: id, speaker_id, source, photographer, videographer, hosted_url,
 * hosted_elsewhere, replace). A video may carry NO bytes (hosted link only) — then
 * `bytes` is null and the route decides whether that's valid. Throws 400 on a bad
 * body / url and 413 when bytes exceed the caller-provided medium limit.
 */
export interface ParsedMediaRequest {
  bytes: Uint8Array | null
  file_name: string | null
  file_type: string | null
  fields: Record<string, unknown>
}

export async function parse_media_request(event: { request: Request }, { max_bytes, medium }: {
  max_bytes: number
  medium: 'audio' | 'photo' | 'video'
}): Promise<ParsedMediaRequest> {
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
      assert_within_cap({ byte_length: blob.size, max_bytes, medium })
      const bytes = new Uint8Array(await blob.arrayBuffer())
      return { bytes, file_name: blob.name || 'upload', file_type: blob.type || 'application/octet-stream', fields }
    }
    return { bytes: null, file_name: null, file_type: null, fields }
  }

  const body = await event.request.json().catch(() => {
    error(ResponseCodes.BAD_REQUEST, 'Invalid JSON body')
  }) as Record<string, unknown>
  const { url, file: _file, ...fields } = body
  if (typeof url === 'string' && url.trim())
    return { ...(await fetch_remote_media({ url: url.trim(), max_bytes, medium })), fields }
  return { bytes: null, file_name: null, file_type: null, fields }
}

function assert_within_cap({ byte_length, max_bytes, medium }: { byte_length: number, max_bytes: number, medium: 'audio' | 'photo' | 'video' }): void {
  if (byte_length > max_bytes) {
    const hosted_hint = medium === 'video' ? '; for larger video use a hosted_elsewhere link' : ''
    error(ResponseCodes.PAYLOAD_TOO_LARGE, `File exceeds the ${Math.round(max_bytes / 1024 / 1024)}MB ${medium} limit${hosted_hint}`)
  }
}

async function fetch_remote_media({ url, max_bytes, medium }: {
  url: string
  max_bytes: number
  medium: 'audio' | 'photo' | 'video'
}): Promise<{ bytes: Uint8Array, file_name: string, file_type: string }> {
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
  if (declared_length)
    assert_within_cap({ byte_length: declared_length, max_bytes, medium })

  const bytes = new Uint8Array(await response.arrayBuffer())
  assert_within_cap({ byte_length: bytes.byteLength, max_bytes, medium })

  const file_type = (response.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim()
  const file_name = parsed.pathname.split('/').filter(Boolean).pop() || 'download'
  return { bytes, file_name, file_type }
}
