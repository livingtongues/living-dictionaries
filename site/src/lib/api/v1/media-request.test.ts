import { MAX_AUDIO_UPLOAD_BYTES, MAX_VIDEO_UPLOAD_BYTES } from '$lib/constants'
import { parse_media_request } from './media-request'

function multipart_event(file: { size: number, name: string, type: string, arrayBuffer: () => Promise<ArrayBuffer> }) {
  const form = {
    entries: () => [][Symbol.iterator](),
    get: (key: string) => key === 'file' ? file : null,
  }
  return {
    request: {
      headers: new Headers({ 'content-type': 'multipart/form-data; boundary=test' }),
      formData: () => Promise.resolve(form),
    } as unknown as Request,
  }
}

describe(parse_media_request, () => {
  test('rejects an oversized multipart file before reading its bytes', async () => {
    const arrayBuffer = vi.fn(() => Promise.resolve(new ArrayBuffer(0)))
    await expect(parse_media_request(multipart_event({
      size: MAX_AUDIO_UPLOAD_BYTES + 1,
      name: 'large.wav',
      type: 'audio/wav',
      arrayBuffer,
    }), { max_bytes: MAX_AUDIO_UPLOAD_BYTES, medium: 'audio' })).rejects.toMatchObject({ status: 413 })
    expect(arrayBuffer).not.toHaveBeenCalled()
  })

  test('the same declared size is allowed for video under its 100 MiB cap', async () => {
    const bytes = new Uint8Array([0, 0, 0, 0])
    const parsed = await parse_media_request(multipart_event({
      size: MAX_AUDIO_UPLOAD_BYTES + 1,
      name: 'clip.mp4',
      type: 'video/mp4',
      arrayBuffer: () => Promise.resolve(bytes.buffer),
    }), { max_bytes: MAX_VIDEO_UPLOAD_BYTES, medium: 'video' })
    expect(parsed.file_name).toBe('clip.mp4')
    expect(parsed.bytes).toEqual(bytes)
  })

  test('rejects a fetched video from its Content-Length before downloading the body', async () => {
    const arrayBuffer = vi.fn(() => Promise.resolve(new ArrayBuffer(0)))
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true,
      headers: new Headers({ 'content-length': String(MAX_VIDEO_UPLOAD_BYTES + 1), 'content-type': 'video/mp4' }),
      arrayBuffer,
    })))
    const request = new Request('https://ld.test/api', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/large.mp4' }),
    })
    await expect(parse_media_request({ request }, { max_bytes: MAX_VIDEO_UPLOAD_BYTES, medium: 'video' }))
      .rejects.toMatchObject({ status: 413 })
    expect(arrayBuffer).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
