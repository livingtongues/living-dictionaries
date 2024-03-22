import type { DbOperations } from '$lib/dbOperations'

/* eslint-disable require-await */
export const logDbOperations: DbOperations = {
  deleteEntry: async (args) => { console.info({deleteEntry: args}) },
  deleteVideo: async (args) => { console.info({deleteVideo: args}) },
  deleteImage: async (args) => { console.info({deleteImage: args}) },
  updateFirestoreEntry: async (args) => { console.info({updateFirestoreEntry: args})},
  update_sense: async (args) => { console.info({args}) },
  update_sentence: async (args) => { console.info(args) }
}
