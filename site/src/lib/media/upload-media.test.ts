import { get } from 'svelte/store'
import type { MediaUploadProgress } from './upload-media'
import { upload_media } from './upload-media'
import { api_upload } from '$api/upload/_call'

vi.mock('$api/upload/_call', () => ({ api_upload: vi.fn() }))

const mocked_api_upload = vi.mocked(api_upload)

class FakeXHR {
  static instances: FakeXHR[] = []
  status = 0
  responseText = ''
  aborted = false
  opened: { method: string, url: string } | null = null
  headers: Record<string, string> = {}
  sent: unknown = null
  upload: { addEventListener: (type: string, callback: (event: { lengthComputable: boolean, loaded: number, total: number }) => void) => void }
  private listeners: Record<string, () => void> = {}
  private upload_listeners: Record<string, (event: { lengthComputable: boolean, loaded: number, total: number }) => void> = {}

  constructor() {
    FakeXHR.instances.push(this)
    this.upload = {
      addEventListener: (type, callback) => {
        this.upload_listeners[type] = callback
      },
    }
  }

  addEventListener(type: string, callback: () => void) {
    this.listeners[type] = callback
  }

  open(method: string, url: string) {
    this.opened = { method, url }
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value
  }

  send(body: unknown) {
    this.sent = body
  }

  abort() {
    this.aborted = true
    this.listeners.abort?.()
  }

  emit_progress(loaded: number, total: number) {
    this.upload_listeners.progress?.({ lengthComputable: true, loaded, total })
  }

  finish(status: number, response_text = '') {
    this.status = status
    this.responseText = response_text
    this.listeners.load?.()
  }

  fail() {
    this.listeners.error?.()
  }
}

vi.stubGlobal('XMLHttpRequest', FakeXHR)
if (typeof URL.createObjectURL !== 'function')
  (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => 'blob:mock'

const PHOTO_ID = '48af49b0-b410-4db1-babf-38ac53269e62'
const AUDIO_ID = '5a1975e8-a3fe-4b8e-b114-597007d20b0c'

function presign_ok(overrides: Record<string, unknown> = {}) {
  mocked_api_upload.mockResolvedValue({
    data: { presigned_upload_url: 'https://r2/put', bucket: 'bkt', object_key: `demo/audio/${AUDIO_ID}.mp3`, item_id: AUDIO_ID, ...overrides },
    error: null,
  } as Awaited<ReturnType<typeof api_upload>>)
}

async function latest_xhr(): Promise<FakeXHR> {
  await vi.waitFor(() => {
    if (!FakeXHR.instances.length)
      throw new Error('no XHR created yet')
  })
  return FakeXHR.instances[FakeXHR.instances.length - 1]
}

const image_file = () => new File(['bytes'], 'photo.jpg', { type: 'image/jpeg' })

beforeEach(() => {
  FakeXHR.instances = []
  mocked_api_upload.mockReset()
})

describe(upload_media, () => {
  test('happy image path: multipart POST to /api/photo-upload, resolves with the returned storage_path', async () => {
    const handle = upload_media({ file: image_file(), dictionary_id: 'demo', kind: 'image', media_id: PHOTO_ID })
    const xhr = await latest_xhr()
    expect(xhr.opened).toEqual({ method: 'POST', url: '/api/photo-upload' })
    expect(xhr.headers).toEqual({}) // FormData sets its own multipart boundary
    const form = xhr.sent as FormData
    expect(form.get('dictionary_id')).toBe('demo')
    expect(form.get('photo_id')).toBe(PHOTO_ID)
    expect((form.get('file') as File).name).toBe('photo.jpg')
    xhr.finish(200, JSON.stringify({ storage_path: `demo/photo/${PHOTO_ID}.jpg` }))
    await expect(handle.done).resolves.toEqual({ storage_path: `demo/photo/${PHOTO_ID}.jpg` })
    expect(mocked_api_upload).not.toHaveBeenCalled() // images skip the presign flow entirely
    expect(get(handle.progress).progress).toBe(100)
  })

  test('image done rejects on a non-2xx POST status', async () => {
    const handle = upload_media({ file: image_file(), dictionary_id: 'demo', kind: 'image', media_id: PHOTO_ID })
    const xhr = await latest_xhr()
    xhr.finish(413)
    await expect(handle.done).rejects.toThrow('Failed to upload file (status 413).')
  })

  test('done rejects on presign error and no XHR is ever created (audio)', async () => {
    mocked_api_upload.mockResolvedValue({ data: null, error: { message: 'not allowed' } } as Awaited<ReturnType<typeof api_upload>>)
    const handle = upload_media({ file: new Blob(['bytes'], { type: 'audio/mpeg' }), dictionary_id: 'demo', kind: 'audio', media_id: AUDIO_ID })
    await expect(handle.done).rejects.toThrow('not allowed')
    expect(FakeXHR.instances).toHaveLength(0)
  })

  test('done rejects on an XHR network error', async () => {
    const handle = upload_media({ file: image_file(), dictionary_id: 'demo', kind: 'image', media_id: PHOTO_ID })
    const xhr = await latest_xhr()
    xhr.fail()
    await expect(handle.done).rejects.toThrow('Failed to upload file.')
  })

  test('done rejects after abort()', async () => {
    const handle = upload_media({ file: image_file(), dictionary_id: 'demo', kind: 'image', media_id: PHOTO_ID })
    const xhr = await latest_xhr()
    handle.abort()
    expect(xhr.aborted).toBeTruthy()
    await expect(handle.done).rejects.toThrow('Upload aborted.')
  })

  test('progress store emits monotonic progress-only values (99 cap until done)', async () => {
    const handle = upload_media({ file: image_file(), dictionary_id: 'demo', kind: 'image', media_id: PHOTO_ID })
    const emissions: MediaUploadProgress[] = []
    handle.progress.subscribe(value => emissions.push(value))
    const xhr = await latest_xhr()
    xhr.emit_progress(10, 100)
    xhr.emit_progress(50, 100)
    xhr.emit_progress(100, 100)
    xhr.finish(200, JSON.stringify({ storage_path: `demo/photo/${PHOTO_ID}.jpg` }))
    await handle.done
    expect(emissions.map(emission => emission.progress)).toEqual([0, 10, 50, 99, 100])
    for (const emission of emissions)
      expect(Object.keys(emission).sort()).toEqual(['preview_url', 'progress'])
  })

  test('audio blob: presign + PUT with codec-stripped file name and r2_media, no preview_url', async () => {
    presign_ok({ object_key: `demo/audio/${AUDIO_ID}.webm` })
    const handle = upload_media({ file: new Blob(['bytes'], { type: 'audio/webm;codecs=opus' }), dictionary_id: 'demo', kind: 'audio', media_id: AUDIO_ID })
    expect(get(handle.progress).preview_url).toBe(undefined)
    const xhr = await latest_xhr()
    expect(xhr.opened).toEqual({ method: 'PUT', url: 'https://r2/put' })
    expect(xhr.headers).toEqual({ 'Content-Type': 'audio/webm;codecs=opus' })
    xhr.finish(201)
    await expect(handle.done).resolves.toEqual({ storage_path: `demo/audio/${AUDIO_ID}.webm` })
    expect(mocked_api_upload).toHaveBeenCalledWith({ dictionary_id: 'demo', file_name: 'audio.webm', file_type: 'audio/webm;codecs=opus', file_size: 5, r2_media: { kind: 'audio', media_id: AUDIO_ID } })
  })

  test('video File keeps its own name', async () => {
    presign_ok({ object_key: `demo/video/${AUDIO_ID}.mp4` })
    const handle = upload_media({ file: new File(['bytes'], 'clip.mp4', { type: 'video/mp4' }), dictionary_id: 'demo', kind: 'video', media_id: AUDIO_ID })
    const xhr = await latest_xhr()
    xhr.finish(200)
    await expect(handle.done).resolves.toEqual({ storage_path: `demo/video/${AUDIO_ID}.mp4` })
    expect(mocked_api_upload).toHaveBeenCalledWith({ dictionary_id: 'demo', file_name: 'clip.mp4', file_type: 'video/mp4', file_size: 5, r2_media: { kind: 'video', media_id: AUDIO_ID } })
  })
})
