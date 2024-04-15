import { readable } from 'svelte/store'
import type { DbOperations } from '$lib/dbOperations'

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
    return readable({ progress: 25 })
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
