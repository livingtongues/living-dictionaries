import type { DbOperations } from '$lib/dbOperations'

/* eslint-disable require-await */
export const logDbOperations: DbOperations = {
  updateFirestoreEntry: async (args) => { console.info({updateFirestoreEntry: args})},
  update_sense: async (args) => { console.info({args}) },
  update_sentence: async (args) => { console.info(args) }
}
