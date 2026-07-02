import { insert_audio, insert_photo, insert_video } from '$lib/db/dict-client/operations'
import { page } from '$app/state'
import { upload_image } from '$lib/components/image/upload-image'
import { upload_audio } from '$lib/components/audio/upload-audio'
import { upload_video } from '$lib/components/video/upload-video'

export function addImage({ sense_id, image_options }: { sense_id: string, image_options: { file: File, source: string, photographer?: string } }) {
  const { file, source, photographer } = image_options
  const { data: { dictionary } } = page
  const status = upload_image({ file, folder: `${dictionary.id}/images/${sense_id}` })
  const unsubscribe = status.subscribe(async ({ storage_path, serving_url }) => {
    if (storage_path && serving_url) {
      await insert_photo({ photo: { storage_path, serving_url, source, photographer }, sense_id })
      unsubscribe()
    }
  })
  return status
}

/** Attribution: `speaker_id` and/or `source` (a `sources.slug` registry ref) — at least one. */
export function addAudio({ entry_id, speaker_id, source, file }: { entry_id: string, speaker_id?: string, source?: string, file: File | Blob }) {
  const { data: { dictionary } } = page
  const status = upload_audio({ file, folder: `${dictionary.id}/audio/${entry_id}` })
  const unsubscribe = status.subscribe(async ({ storage_path }) => {
    if (storage_path) {
      // ONE atomic dict_write: audio row + speaker junction commit together.
      await insert_audio({ storage_path, entry_id, speaker_id, source })
      unsubscribe()
    }
  })
  return status
}

/** Attribution: `speaker_id` and/or `source` (a `sources.slug` registry ref) — at least one. */
export function uploadVideo({ sense_id, speaker_id, source, file }: { sense_id: string, speaker_id?: string, source?: string, file: File | Blob }) {
  const { data: { dictionary } } = page
  const status = upload_video({ file, folder: `${dictionary.id}/videos/${sense_id}` })
  const unsubscribe = status.subscribe(async ({ storage_path }) => {
    if (storage_path) {
      // ONE atomic dict_write: video + sense junction + speaker junction.
      await insert_video({ video: { storage_path, ...(source ? { source } : {}) }, sense_id, speaker_id })
      unsubscribe()
    }
  })
  return status
}

export { DEV_LOCAL_PREFIX, image_src, url_from_storage_path } from './media-url'
