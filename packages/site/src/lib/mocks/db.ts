import { readable, writable } from 'svelte/store'
import { sleep } from 'kitbook'
import type { DbOperations } from '$lib/dbOperations'
import type { AudioUploadStatus } from '$lib/components/audio/upload-audio'

/* eslint-disable require-await */
export const logDbOperations: DbOperations = {
  add_speaker: async (args) => {
    console.info({ add_speaker: args })
    return 'speaker-id'
  },
  addImage: (entryId: string, file: File) => {
    console.info({ entryId, file })
    return readable({ progress: 25, preview_url: URL.createObjectURL(file) })
  },
  addAudio: ({ entryId, speakerId, file }) => {
    console.info({ entryId, speakerId, file })
    const { set, subscribe } = writable<AudioUploadStatus>({ progress: 0 })
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
  addVideo: async (args) => { console.info({ addVideo: args }) },
  deleteAudio: async (args) => { console.info({ deleteAudio: args }) },
  addNewEntry: async (args) => { console.info({ addNewEntry: args }) },
  deleteEntry: async (args) => { console.info({ deleteEntry: args }) },
  deleteVideo: async (args) => { console.info({ deleteVideo: args }) },
  deleteImage: async (args) => { console.info({ deleteImage: args }) },
  updateEntry: async (args) => { console.info({ updateEntry: args }) },
  updateEntryOnline: async (args) => { console.info({ updateEntryOnline: args }) },
  update_sense: async (args) => { console.info({ args }) },
  update_sentence: async (args) => { console.info(args) },
}
