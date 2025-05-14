import { readable, writable } from 'svelte/store'
import { sleep } from 'kitbook'
import type { DbOperations } from '$lib/dbOperations'
import type { AudioVideoUploadStatus } from '$lib/components/audio/upload-audio'

const log_args = (args: any) => console.info({ args }) as unknown as Promise<any>

export const logDbOperations: DbOperations = {
  addImage: ({ sense_id, file }) => {
    console.info({ sense_id, file })
    return readable({ progress: 25, preview_url: URL.createObjectURL(file) })
  },
  addAudio: ({ entry_id, speaker_id, file }) => {
    console.info({ entry_id, speaker_id, file })
    const { set, subscribe } = writable<AudioVideoUploadStatus>({ progress: 0 })
    const raise_progresss = async () => {
      for (let progress = 0; progress <= 100; progress += 5) {
        set({ progress })
        await sleep(100)
      }
      set({ progress: 100 })
    }
    raise_progresss()
    return { subscribe }
    // return readable({ progress: 25 })
  },
  uploadVideo: ({ sense_id, speaker_id, file }) => {
    console.info({ sense_id, speaker_id, file })
    const { set, subscribe } = writable<AudioVideoUploadStatus>({ progress: 0 })
    const raise_progresss = async () => {
      for (let progress = 0; progress <= 100; progress += 5) {
        set({ progress })
        await sleep(100)
      }
      set({ progress: 100 })
    }
    raise_progresss()
    return { subscribe }
  },

  insert_entry: log_args,
  update_entry: log_args,
  insert_sense: log_args,
  update_sense: log_args,
  insert_sentence: log_args,
  update_sentence: log_args,
  insert_audio: log_args,
  update_audio: log_args,
  insert_speaker: log_args,
  assign_speaker: log_args,
  insert_tag: log_args,
  assign_tag: log_args,
  insert_dialect: log_args,
  assign_dialect: log_args,
  insert_photo: log_args,
  update_photo: log_args,
  insert_video: log_args,
  update_video: log_args,

}
