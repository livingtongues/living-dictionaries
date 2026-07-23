import { readable } from 'svelte/store'
import type { MediaUploadHandle } from './upload-media'
import { upload_media } from './upload-media'
import type { GuardedWrites } from '$lib/db/dict-client/guarded-writes'

// Upload→insert orchestrators: `done` includes the DB insert, so a failed
// upload REJECTS `done` and no row is ever inserted. Callers render
// `handle.progress` and `try { await handle.done } catch { show error }`.
// The insert goes through the guarded writes facade (`page.data.writes`),
// passed in explicitly so this module stays free of `page.data` coupling.
//
// Readiness is checked UP FRONT via `writes.check_ready()` (uploads are slow;
// a write blocked only at insert time would drop the row after the bytes
// landed and after the caller's modal closed) and RE-CHECKED at insert time by
// the guard itself — a swallowed insert (`undefined`) rejects `done` so the
// caller's error path runs instead of a phantom success.

/** A handle whose `done` is already rejected — for writes blocked before upload start. */
function blocked_handle(error: Error): MediaUploadHandle {
  const done = Promise.reject(error)
  done.catch(() => undefined)
  return { progress: readable({ progress: 0 }), done, abort: () => undefined }
}

export function add_photo({ writes, dictionary_id, sense_id, file, source, photographer }: {
  writes: Pick<GuardedWrites, 'check_ready' | 'insert_photo'>
  dictionary_id: string
  sense_id: string
  file: File
  source: string
  photographer?: string
}): MediaUploadHandle {
  const not_ready = writes.check_ready()
  if (not_ready)
    return blocked_handle(not_ready)
  const handle = upload_media({ file, folder: `${dictionary_id}/images/${sense_id}`, dictionary_id, kind: 'image' })
  const done = handle.done.then(async ({ storage_path, serving_url }) => {
    const inserted = await writes.insert_photo({ photo: { storage_path, serving_url, source, photographer }, sense_id })
    if (!inserted)
      throw new Error('The photo was uploaded but could not be saved — please try again.')
    return { storage_path, serving_url }
  })
  done.catch(() => undefined) // surfaced to callers awaiting `done`; upload errors already logged
  return { ...handle, done }
}

/** Attribution: `speaker_id` and/or `source` (a `sources.slug` registry ref) — at least one. */
export function add_audio({ writes, dictionary_id, entry_id, file, speaker_id, source }: {
  writes: Pick<GuardedWrites, 'check_ready' | 'insert_audio'>
  dictionary_id: string
  entry_id: string
  file: File | Blob
  speaker_id?: string
  source?: string
}): MediaUploadHandle {
  const not_ready = writes.check_ready()
  if (not_ready)
    return blocked_handle(not_ready)
  // Row uuid is minted BEFORE upload — the R2 object is keyed by it (`{dict}/audio/{id}.{ext}`).
  const media_id = crypto.randomUUID()
  const handle = upload_media({ file, folder: `${dictionary_id}/audio/${entry_id}`, dictionary_id, kind: 'audio', media_id })
  const done = handle.done.then(async ({ storage_path }) => {
    // ONE atomic dict_write: audio row + speaker junction commit together.
    const inserted = await writes.insert_audio({ id: media_id, storage_path, entry_id, speaker_id, source })
    if (!inserted)
      throw new Error('The audio was uploaded but could not be saved — please try again.')
    return { storage_path }
  })
  done.catch(() => undefined)
  return { ...handle, done }
}

/** Attribution: `speaker_id` and/or `source` (a `sources.slug` registry ref) — at least one. */
export function add_video({ writes, dictionary_id, sense_id, file, speaker_id, source }: {
  writes: Pick<GuardedWrites, 'check_ready' | 'insert_video'>
  dictionary_id: string
  sense_id: string
  file: File | Blob
  speaker_id?: string
  source?: string
}): MediaUploadHandle {
  const not_ready = writes.check_ready()
  if (not_ready)
    return blocked_handle(not_ready)
  // Row uuid is minted BEFORE upload — the R2 object is keyed by it (`{dict}/video/{id}.{ext}`).
  const media_id = crypto.randomUUID()
  const handle = upload_media({ file, folder: `${dictionary_id}/videos/${sense_id}`, dictionary_id, kind: 'video', media_id })
  const done = handle.done.then(async ({ storage_path }) => {
    // ONE atomic dict_write: video + sense junction + speaker junction.
    const inserted = await writes.insert_video({ video: { id: media_id, storage_path, ...(source ? { source } : {}) }, sense_id, speaker_id })
    if (!inserted)
      throw new Error('The video was uploaded but could not be saved — please try again.')
    return { storage_path }
  })
  done.catch(() => undefined)
  return { ...handle, done }
}
