import { readable } from 'svelte/store'
import type { MediaUploadHandle, MediaUploadResult } from './upload-media'
import { upload_media } from './upload-media'
import { add_audio, add_photo, add_video } from './add-media'

vi.mock('./upload-media', () => ({ upload_media: vi.fn() }))

const mocked_upload_media = vi.mocked(upload_media)

function fake_handle(done: Promise<MediaUploadResult>): MediaUploadHandle {
  done.catch(() => undefined)
  return { progress: readable({ progress: 0 }), done, abort: vi.fn() }
}

const insert_photo = vi.fn()
const insert_audio = vi.fn()
const insert_video = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
})

describe(add_photo, () => {
  const writes = { insert_photo }

  test('uploads to the sense image folder then inserts the photo row', async () => {
    mocked_upload_media.mockReturnValue(fake_handle(Promise.resolve({ storage_path: 'demo/images/s1/1.jpg', serving_url: 'lh3-hash' })))
    const handle = add_photo({ writes, dictionary_id: 'demo', sense_id: 's1', file: new File(['x'], 'photo.jpg', { type: 'image/jpeg' }), source: 'my source', photographer: 'Ana' })
    await expect(handle.done).resolves.toEqual({ storage_path: 'demo/images/s1/1.jpg', serving_url: 'lh3-hash' })
    expect(mocked_upload_media).toHaveBeenCalledWith(expect.objectContaining({ folder: 'demo/images/s1', dictionary_id: 'demo', kind: 'image' }))
    expect(insert_photo).toHaveBeenCalledWith({
      photo: { storage_path: 'demo/images/s1/1.jpg', serving_url: 'lh3-hash', source: 'my source', photographer: 'Ana' },
      sense_id: 's1',
    })
  })

  test('NO insert when the upload fails — done rejects instead', async () => {
    mocked_upload_media.mockReturnValue(fake_handle(Promise.reject(new Error('PUT failed'))))
    const handle = add_photo({ writes, dictionary_id: 'demo', sense_id: 's1', file: new File(['x'], 'photo.jpg', { type: 'image/jpeg' }), source: 'my source' })
    await expect(handle.done).rejects.toThrow('PUT failed')
    expect(insert_photo).not.toHaveBeenCalled()
  })
})

describe(add_audio, () => {
  const writes = { insert_audio }

  test('uploads to the entry audio folder then runs the atomic audio+speaker insert', async () => {
    mocked_upload_media.mockReturnValue(fake_handle(Promise.resolve({ storage_path: 'demo/audio/e1/1.webm' })))
    const handle = add_audio({ writes, dictionary_id: 'demo', entry_id: 'e1', file: new Blob(['x'], { type: 'audio/webm' }), speaker_id: 'sp1', source: 'field-recordings' })
    await expect(handle.done).resolves.toEqual({ storage_path: 'demo/audio/e1/1.webm' })
    expect(mocked_upload_media).toHaveBeenCalledWith(expect.objectContaining({ folder: 'demo/audio/e1', dictionary_id: 'demo', kind: 'audio' }))
    expect(insert_audio).toHaveBeenCalledWith({ storage_path: 'demo/audio/e1/1.webm', entry_id: 'e1', speaker_id: 'sp1', source: 'field-recordings' })
  })

  test('NO insert when the upload fails', async () => {
    mocked_upload_media.mockReturnValue(fake_handle(Promise.reject(new Error('network down'))))
    const handle = add_audio({ writes, dictionary_id: 'demo', entry_id: 'e1', file: new Blob(['x'], { type: 'audio/webm' }), speaker_id: 'sp1' })
    await expect(handle.done).rejects.toThrow('network down')
    expect(insert_audio).not.toHaveBeenCalled()
  })
})

describe(add_video, () => {
  const writes = { insert_video }

  test('uploads to the sense video folder then runs the atomic video insert (source included when given)', async () => {
    mocked_upload_media.mockReturnValue(fake_handle(Promise.resolve({ storage_path: 'demo/videos/s1/1.mp4' })))
    const handle = add_video({ writes, dictionary_id: 'demo', sense_id: 's1', file: new Blob(['x'], { type: 'video/mp4' }), speaker_id: 'sp1', source: 'archive' })
    await expect(handle.done).resolves.toEqual({ storage_path: 'demo/videos/s1/1.mp4' })
    expect(mocked_upload_media).toHaveBeenCalledWith(expect.objectContaining({ folder: 'demo/videos/s1', dictionary_id: 'demo', kind: 'video' }))
    expect(insert_video).toHaveBeenCalledWith({ video: { storage_path: 'demo/videos/s1/1.mp4', source: 'archive' }, sense_id: 's1', speaker_id: 'sp1' })
  })

  test('omits source from the video row when not given', async () => {
    mocked_upload_media.mockReturnValue(fake_handle(Promise.resolve({ storage_path: 'demo/videos/s1/1.mp4' })))
    const handle = add_video({ writes, dictionary_id: 'demo', sense_id: 's1', file: new Blob(['x'], { type: 'video/mp4' }), speaker_id: 'sp1' })
    await handle.done
    expect(insert_video).toHaveBeenCalledWith({ video: { storage_path: 'demo/videos/s1/1.mp4' }, sense_id: 's1', speaker_id: 'sp1' })
  })

  test('NO insert when the upload fails', async () => {
    mocked_upload_media.mockReturnValue(fake_handle(Promise.reject(new Error('aborted'))))
    const handle = add_video({ writes, dictionary_id: 'demo', sense_id: 's1', file: new Blob(['x'], { type: 'video/mp4' }), speaker_id: 'sp1' })
    await expect(handle.done).rejects.toThrow('aborted')
    expect(insert_video).not.toHaveBeenCalled()
  })
})
