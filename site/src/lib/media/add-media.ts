import type { MediaUploadHandle } from './upload-media'
import { upload_media } from './upload-media'
import type { GuardedWrites } from '$lib/db/dict-client/guarded-writes'

// Upload→insert orchestrators: `done` includes the DB insert, so a failed
// upload REJECTS `done` and no row is ever inserted. Callers render
// `handle.progress` and `try { await handle.done } catch { show error }`.
// The insert goes through the guarded writes facade (`page.data.writes`),
// passed in explicitly so this module stays free of `page.data` coupling.

export function add_photo({ writes, dictionary_id, sense_id, file, source, photographer }: {
  writes: Pick<GuardedWrites, 'insert_photo'>
  dictionary_id: string
  sense_id: string
  file: File
  source: string
  photographer?: string
}): MediaUploadHandle {
  const handle = upload_media({ file, folder: `${dictionary_id}/images/${sense_id}`, dictionary_id, kind: 'image' })
  const done = handle.done.then(async ({ storage_path, serving_url }) => {
    await writes.insert_photo({ photo: { storage_path, serving_url, source, photographer }, sense_id })
    return { storage_path, serving_url }
  })
  done.catch(() => undefined) // surfaced to callers awaiting `done`; upload errors already logged
  return { ...handle, done }
}

/** Attribution: `speaker_id` and/or `source` (a `sources.slug` registry ref) — at least one. */
export function add_audio({ writes, dictionary_id, entry_id, file, speaker_id, source }: {
  writes: Pick<GuardedWrites, 'insert_audio'>
  dictionary_id: string
  entry_id: string
  file: File | Blob
  speaker_id?: string
  source?: string
}): MediaUploadHandle {
  const handle = upload_media({ file, folder: `${dictionary_id}/audio/${entry_id}`, dictionary_id, kind: 'audio' })
  const done = handle.done.then(async ({ storage_path }) => {
    // ONE atomic dict_write: audio row + speaker junction commit together.
    await writes.insert_audio({ storage_path, entry_id, speaker_id, source })
    return { storage_path }
  })
  done.catch(() => undefined)
  return { ...handle, done }
}

/** Attribution: `speaker_id` and/or `source` (a `sources.slug` registry ref) — at least one. */
export function add_video({ writes, dictionary_id, sense_id, file, speaker_id, source }: {
  writes: Pick<GuardedWrites, 'insert_video'>
  dictionary_id: string
  sense_id: string
  file: File | Blob
  speaker_id?: string
  source?: string
}): MediaUploadHandle {
  const handle = upload_media({ file, folder: `${dictionary_id}/videos/${sense_id}`, dictionary_id, kind: 'video' })
  const done = handle.done.then(async ({ storage_path }) => {
    // ONE atomic dict_write: video + sense junction + speaker junction.
    await writes.insert_video({ video: { storage_path, ...(source ? { source } : {}) }, sense_id, speaker_id })
    return { storage_path }
  })
  done.catch(() => undefined)
  return { ...handle, done }
}
