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

const check_ready = vi.fn<() => Error | null>()
const insert_photo = vi.fn()
const insert_audio = vi.fn()
const insert_video = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  check_ready.mockReturnValue(null)
  insert_photo.mockResolvedValue({ id: 'photo-1' })
  insert_audio.mockResolvedValue({ id: 'audio-1' })
  insert_video.mockResolvedValue({ id: 'video-1' })
})

describe(add_photo, () => {
  const writes = { check_ready, insert_photo }

  test('uploads with a pre-minted row uuid then inserts the photo row (serving_url empty on the R2 convention)', async () => {
    mocked_upload_media.mockReturnValue(fake_handle(Promise.resolve({ storage_path: 'demo/photo/x.jpg' })))
    const handle = add_photo({ writes, dictionary_id: 'demo', sense_id: 's1', file: new File(['x'], 'photo.jpg', { type: 'image/jpeg' }), source: 'my source', photographer: 'Ana' })
    await expect(handle.done).resolves.toEqual({ storage_path: 'demo/photo/x.jpg' })
    expect(mocked_upload_media).toHaveBeenCalledWith(expect.objectContaining({ dictionary_id: 'demo', kind: 'image', media_id: expect.stringMatching(/^[0-9a-f-]{36}$/) }))
    const minted_id = mocked_upload_media.mock.calls[0][0].media_id
    expect(insert_photo).toHaveBeenCalledWith({
      photo: { id: minted_id, storage_path: 'demo/photo/x.jpg', serving_url: '', source: 'my source', photographer: 'Ana' },
      sense_id: 's1',
    })
  })

  test('NO insert when the upload fails — done rejects instead', async () => {
    mocked_upload_media.mockReturnValue(fake_handle(Promise.reject(new Error('PUT failed'))))
    const handle = add_photo({ writes, dictionary_id: 'demo', sense_id: 's1', file: new File(['x'], 'photo.jpg', { type: 'image/jpeg' }), source: 'my source' })
    await expect(handle.done).rejects.toThrow('PUT failed')
    expect(insert_photo).not.toHaveBeenCalled()
  })

  test('writes not ready → NO upload starts and done rejects with the blocked error', async () => {
    check_ready.mockReturnValue(new Error('Wait until loading spinner stops to make edits.'))
    const handle = add_photo({ writes, dictionary_id: 'demo', sense_id: 's1', file: new File(['x'], 'photo.jpg', { type: 'image/jpeg' }), source: 'my source' })
    await expect(handle.done).rejects.toThrow('Wait until loading spinner stops to make edits.')
    expect(mocked_upload_media).not.toHaveBeenCalled()
    expect(insert_photo).not.toHaveBeenCalled()
  })

  test('insert swallowed by the guard (resolves undefined) → done rejects instead of phantom success', async () => {
    mocked_upload_media.mockReturnValue(fake_handle(Promise.resolve({ storage_path: 'demo/photo/x.jpg' })))
    insert_photo.mockResolvedValue(undefined)
    const handle = add_photo({ writes, dictionary_id: 'demo', sense_id: 's1', file: new File(['x'], 'photo.jpg', { type: 'image/jpeg' }), source: 'my source' })
    await expect(handle.done).rejects.toThrow('could not be saved')
  })
})

describe(add_audio, () => {
  const writes = { check_ready, insert_audio }

  test('uploads with a pre-minted row uuid then runs the atomic audio+speaker insert', async () => {
    mocked_upload_media.mockReturnValue(fake_handle(Promise.resolve({ storage_path: 'demo/audio/e1/1.webm' })))
    const handle = add_audio({ writes, dictionary_id: 'demo', entry_id: 'e1', file: new Blob(['x'], { type: 'audio/webm' }), speaker_id: 'sp1', source: 'field-recordings' })
    await expect(handle.done).resolves.toEqual({ storage_path: 'demo/audio/e1/1.webm' })
    expect(mocked_upload_media).toHaveBeenCalledWith(expect.objectContaining({ dictionary_id: 'demo', kind: 'audio', media_id: expect.stringMatching(/^[0-9a-f-]{36}$/) }))
    const minted_id = mocked_upload_media.mock.calls[0][0].media_id
    expect(insert_audio).toHaveBeenCalledWith({ id: minted_id, storage_path: 'demo/audio/e1/1.webm', entry_id: 'e1', speaker_id: 'sp1', source: 'field-recordings' })
  })

  test('text_id / sentence_id owners pass through to the insert', async () => {
    mocked_upload_media.mockReturnValue(fake_handle(Promise.resolve({ storage_path: 'demo/audio/t1/1.webm' })))
    const handle = add_audio({ writes, dictionary_id: 'demo', text_id: 't1', file: new Blob(['x'], { type: 'audio/webm' }), speaker_id: 'sp1' })
    await expect(handle.done).resolves.toEqual({ storage_path: 'demo/audio/t1/1.webm' })
    expect(insert_audio).toHaveBeenCalledWith(expect.objectContaining({ text_id: 't1', speaker_id: 'sp1' }))
    expect(insert_audio.mock.calls[0][0].entry_id).toBeUndefined()

    const sentence_handle = add_audio({ writes, dictionary_id: 'demo', sentence_id: 'sen1', file: new Blob(['x'], { type: 'audio/webm' }), speaker_id: 'sp1' })
    await sentence_handle.done
    expect(insert_audio).toHaveBeenCalledWith(expect.objectContaining({ sentence_id: 'sen1' }))
  })

  test('NO insert when the upload fails', async () => {
    mocked_upload_media.mockReturnValue(fake_handle(Promise.reject(new Error('network down'))))
    const handle = add_audio({ writes, dictionary_id: 'demo', entry_id: 'e1', file: new Blob(['x'], { type: 'audio/webm' }), speaker_id: 'sp1' })
    await expect(handle.done).rejects.toThrow('network down')
    expect(insert_audio).not.toHaveBeenCalled()
  })

  test('writes not ready → NO upload starts', async () => {
    check_ready.mockReturnValue(new Error('You must be signed in to edit'))
    const handle = add_audio({ writes, dictionary_id: 'demo', entry_id: 'e1', file: new Blob(['x'], { type: 'audio/webm' }), speaker_id: 'sp1' })
    await expect(handle.done).rejects.toThrow('You must be signed in to edit')
    expect(mocked_upload_media).not.toHaveBeenCalled()
  })

  test('insert swallowed → done rejects', async () => {
    mocked_upload_media.mockReturnValue(fake_handle(Promise.resolve({ storage_path: 'demo/audio/e1/1.webm' })))
    insert_audio.mockResolvedValue(undefined)
    const handle = add_audio({ writes, dictionary_id: 'demo', entry_id: 'e1', file: new Blob(['x'], { type: 'audio/webm' }), speaker_id: 'sp1' })
    await expect(handle.done).rejects.toThrow('could not be saved')
  })
})

describe(add_video, () => {
  const writes = { check_ready, insert_video }

  test('uploads with a pre-minted row uuid then runs the atomic video insert (source included when given)', async () => {
    mocked_upload_media.mockReturnValue(fake_handle(Promise.resolve({ storage_path: 'demo/videos/s1/1.mp4' })))
    const handle = add_video({ writes, dictionary_id: 'demo', sense_id: 's1', file: new Blob(['x'], { type: 'video/mp4' }), speaker_id: 'sp1', source: 'archive' })
    await expect(handle.done).resolves.toEqual({ storage_path: 'demo/videos/s1/1.mp4' })
    expect(mocked_upload_media).toHaveBeenCalledWith(expect.objectContaining({ dictionary_id: 'demo', kind: 'video', media_id: expect.stringMatching(/^[0-9a-f-]{36}$/) }))
    const minted_id = mocked_upload_media.mock.calls[0][0].media_id
    expect(insert_video).toHaveBeenCalledWith({ video: { id: minted_id, storage_path: 'demo/videos/s1/1.mp4', source: 'archive' }, sense_id: 's1', speaker_id: 'sp1' })
  })

  test('omits source from the video row when not given', async () => {
    mocked_upload_media.mockReturnValue(fake_handle(Promise.resolve({ storage_path: 'demo/videos/s1/1.mp4' })))
    const handle = add_video({ writes, dictionary_id: 'demo', sense_id: 's1', file: new Blob(['x'], { type: 'video/mp4' }), speaker_id: 'sp1' })
    await handle.done
    expect(insert_video).toHaveBeenCalledWith({ video: { id: expect.stringMatching(/^[0-9a-f-]{36}$/), storage_path: 'demo/videos/s1/1.mp4' }, sense_id: 's1', speaker_id: 'sp1' })
  })

  test('NO insert when the upload fails', async () => {
    mocked_upload_media.mockReturnValue(fake_handle(Promise.reject(new Error('aborted'))))
    const handle = add_video({ writes, dictionary_id: 'demo', sense_id: 's1', file: new Blob(['x'], { type: 'video/mp4' }), speaker_id: 'sp1' })
    await expect(handle.done).rejects.toThrow('aborted')
    expect(insert_video).not.toHaveBeenCalled()
  })

  test('writes not ready → NO upload starts', async () => {
    check_ready.mockReturnValue(new Error('Editing database is not ready yet'))
    const handle = add_video({ writes, dictionary_id: 'demo', sense_id: 's1', file: new Blob(['x'], { type: 'video/mp4' }), speaker_id: 'sp1' })
    await expect(handle.done).rejects.toThrow('Editing database is not ready yet')
    expect(mocked_upload_media).not.toHaveBeenCalled()
  })

  test('insert swallowed → done rejects', async () => {
    mocked_upload_media.mockReturnValue(fake_handle(Promise.resolve({ storage_path: 'demo/videos/s1/1.mp4' })))
    insert_video.mockResolvedValue(undefined)
    const handle = add_video({ writes, dictionary_id: 'demo', sense_id: 's1', file: new Blob(['x'], { type: 'video/mp4' }), speaker_id: 'sp1' })
    await expect(handle.done).rejects.toThrow('could not be saved')
  })
})
