import { get } from 'svelte/store'
import type { MediaUploadProgress } from './upload-media'
import { upload_media } from './upload-media'
import { api_gcs_serving_url } from '$api/gcs_serving_url/_call'
import { api_upload } from '$api/upload/_call'
import { DEV_LOCAL_PREFIX } from '$lib/utils/media-url'

vi.mock('$api/upload/_call', () => ({ api_upload: vi.fn() }))
vi.mock('$api/gcs_serving_url/_call', () => ({ api_gcs_serving_url: vi.fn() }))

const mocked_api_upload = vi.mocked(api_upload)
const mocked_api_gcs_serving_url = vi.mocked(api_gcs_serving_url)

class FakeXHR {
  static instances: FakeXHR[] = []
  status = 0
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

  finish(status: number) {
    this.status = status
    this.listeners.load?.()
  }

  fail() {
    this.listeners.error?.()
  }
}

vi.stubGlobal('XMLHttpRequest', FakeXHR)
if (typeof URL.createObjectURL !== 'function')
  (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => 'blob:mock'

function presign_ok(overrides: Record<string, unknown> = {}) {
  mocked_api_upload.mockResolvedValue({
    data: { presigned_upload_url: 'https://gcs/put', bucket: 'bkt', object_key: 'demo/images/s1/1.jpg', item_id: '1', ...overrides },
    error: null,
  } as Awaited<ReturnType<typeof api_upload>>)
}

function serving_url_ok(serving_url = 'lh3-hash') {
  mocked_api_gcs_serving_url.mockResolvedValue({ data: { serving_url }, error: null } as Awaited<ReturnType<typeof api_gcs_serving_url>>)
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
  mocked_api_gcs_serving_url.mockReset()
})

describe(upload_media, () => {
  test('happy image path: PUT to the presigned url, then resolves with storage_path + serving_url', async () => {
    presign_ok()
    serving_url_ok()
    const handle = upload_media({ file: image_file(), folder: 'demo/images/s1', dictionary_id: 'demo', kind: 'image' })
    const xhr = await latest_xhr()
    expect(xhr.opened).toEqual({ method: 'PUT', url: 'https://gcs/put' })
    expect(xhr.headers).toEqual({ 'Content-Type': 'image/jpeg' })
    xhr.finish(200)
    await expect(handle.done).resolves.toEqual({ storage_path: 'demo/images/s1/1.jpg', serving_url: 'lh3-hash' })
    expect(mocked_api_gcs_serving_url).toHaveBeenCalledWith({ storage_path: 'bkt/demo/images/s1/1.jpg' })
    expect(get(handle.progress).progress).toBe(100)
  })

  test('done rejects on presign error and no XHR is ever created', async () => {
    mocked_api_upload.mockResolvedValue({ data: null, error: { message: 'not allowed' } } as Awaited<ReturnType<typeof api_upload>>)
    const handle = upload_media({ file: image_file(), folder: 'demo/images/s1', dictionary_id: 'demo', kind: 'image' })
    await expect(handle.done).rejects.toThrow('not allowed')
    expect(FakeXHR.instances).toHaveLength(0)
  })

  test('done rejects on a non-2xx PUT status (used to hang forever)', async () => {
    presign_ok()
    const handle = upload_media({ file: image_file(), folder: 'demo/images/s1', dictionary_id: 'demo', kind: 'image' })
    const xhr = await latest_xhr()
    xhr.finish(403)
    await expect(handle.done).rejects.toThrow('Failed to upload file (status 403).')
    expect(mocked_api_gcs_serving_url).not.toHaveBeenCalled()
  })

  test('done rejects on an XHR network error', async () => {
    presign_ok()
    const handle = upload_media({ file: image_file(), folder: 'demo/images/s1', dictionary_id: 'demo', kind: 'image' })
    const xhr = await latest_xhr()
    xhr.fail()
    await expect(handle.done).rejects.toThrow('Failed to upload file.')
  })

  test('done rejects on a serving-url error', async () => {
    presign_ok()
    mocked_api_gcs_serving_url.mockResolvedValue({ data: null, error: { message: 'no url for you' } } as Awaited<ReturnType<typeof api_gcs_serving_url>>)
    const handle = upload_media({ file: image_file(), folder: 'demo/images/s1', dictionary_id: 'demo', kind: 'image' })
    const xhr = await latest_xhr()
    xhr.finish(200)
    await expect(handle.done).rejects.toThrow('no url for you')
  })

  test('done rejects after abort()', async () => {
    presign_ok()
    const handle = upload_media({ file: image_file(), folder: 'demo/images/s1', dictionary_id: 'demo', kind: 'image' })
    const xhr = await latest_xhr()
    handle.abort()
    expect(xhr.aborted).toBeTruthy()
    await expect(handle.done).rejects.toThrow('Upload aborted.')
  })

  test('progress store emits monotonic progress-only values (99 cap until done)', async () => {
    presign_ok()
    serving_url_ok()
    const handle = upload_media({ file: image_file(), folder: 'demo/images/s1', dictionary_id: 'demo', kind: 'image' })
    const emissions: MediaUploadProgress[] = []
    handle.progress.subscribe(value => emissions.push(value))
    const xhr = await latest_xhr()
    xhr.emit_progress(10, 100)
    xhr.emit_progress(50, 100)
    xhr.emit_progress(100, 100)
    xhr.finish(200)
    await handle.done
    expect(emissions.map(emission => emission.progress)).toEqual([0, 10, 50, 99, 100])
    for (const emission of emissions)
      expect(Object.keys(emission).sort()).toEqual(['preview_url', 'progress'])
  })

  test('dev_mock image: serving_url gets the dev-local sentinel and api_gcs_serving_url is skipped', async () => {
    presign_ok({ dev_mock: true, presigned_upload_url: '/api/dev-media/demo/images/s1/1.jpg' })
    const handle = upload_media({ file: image_file(), folder: 'demo/images/s1', dictionary_id: 'demo', kind: 'image' })
    const xhr = await latest_xhr()
    xhr.finish(200)
    await expect(handle.done).resolves.toEqual({ storage_path: 'demo/images/s1/1.jpg', serving_url: `${DEV_LOCAL_PREFIX}demo/images/s1/1.jpg` })
    expect(mocked_api_gcs_serving_url).not.toHaveBeenCalled()
  })

  test('audio blob: derives a codec-stripped file name, no serving-url step, no preview_url', async () => {
    presign_ok({ object_key: 'demo/audio/e1/1.webm' })
    const handle = upload_media({ file: new Blob(['bytes'], { type: 'audio/webm;codecs=opus' }), folder: 'demo/audio/e1', dictionary_id: 'demo', kind: 'audio' })
    expect(get(handle.progress).preview_url).toBe(undefined)
    const xhr = await latest_xhr()
    xhr.finish(201)
    await expect(handle.done).resolves.toEqual({ storage_path: 'demo/audio/e1/1.webm' })
    expect(mocked_api_upload).toHaveBeenCalledWith({ folder: 'demo/audio/e1', dictionary_id: 'demo', file_name: 'audio.webm', file_type: 'audio/webm;codecs=opus' })
    expect(mocked_api_gcs_serving_url).not.toHaveBeenCalled()
  })

  test('video File keeps its own name', async () => {
    presign_ok({ object_key: 'demo/videos/s1/1.mp4' })
    const handle = upload_media({ file: new File(['bytes'], 'clip.mp4', { type: 'video/mp4' }), folder: 'demo/videos/s1', dictionary_id: 'demo', kind: 'video' })
    const xhr = await latest_xhr()
    xhr.finish(200)
    await expect(handle.done).resolves.toEqual({ storage_path: 'demo/videos/s1/1.mp4' })
    expect(mocked_api_upload).toHaveBeenCalledWith({ folder: 'demo/videos/s1', dictionary_id: 'demo', file_name: 'clip.mp4', file_type: 'video/mp4' })
  })
})
