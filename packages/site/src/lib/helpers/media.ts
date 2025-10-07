import { get } from 'svelte/store'
import { assign_speaker, insert_audio, insert_photo, insert_video } from '$lib/supabase/operations'
import { page } from '$app/stores'
import { upload_image } from '$lib/components/image/upload-image'
import { upload_audio } from '$lib/components/audio/upload-audio'
import { upload_video } from '$lib/components/video/upload-video'

export function addImage({ sense_id, image_options }: { sense_id: string, image_options: { file: File, source: string, photographer?: string } }) {
  const { file, source, photographer } = image_options
  const { data: { dictionary } } = get(page)
  const status = upload_image({ file, folder: `${dictionary.id}/images/${sense_id}` })
  const unsubscribe = status.subscribe(async ({ storage_path, serving_url }) => {
    if (storage_path && serving_url) {
      await insert_photo({ photo: { storage_path, serving_url, source, photographer }, sense_id })
      unsubscribe()
    }
  })
  return status
}

export function addAudio({ entry_id, speaker_id, file }: { entry_id: string, speaker_id: string, file: File | Blob }) {
  const { data: { dictionary } } = get(page)
  const status = upload_audio({ file, folder: `${dictionary.id}/audio/${entry_id}` })
  const unsubscribe = status.subscribe(async ({ storage_path }) => {
    if (storage_path) {
      const audio = await insert_audio({ storage_path, entry_id })
      await assign_speaker({ speaker_id, media: 'audio', media_id: audio.id })
      unsubscribe()
    }
  })
  return status
}

export function uploadVideo({ sense_id, speaker_id, file }: { sense_id: string, speaker_id: string, file: File | Blob }) {
  const { data: { dictionary } } = get(page)
  const status = upload_video({ file, folder: `${dictionary.id}/videos/${sense_id}` })
  const unsubscribe = status.subscribe(async ({ storage_path }) => {
    if (storage_path) {
      const data = await insert_video({ video: { storage_path }, sense_id })
      await assign_speaker({ speaker_id, media: 'video', media_id: data.id })
      unsubscribe()
    }
  })
  return status
}

export function url_from_storage_path(path: string, storage_bucket: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${storage_bucket}/o/${encodeURIComponent(path)}?alt=media`
}
