import type { DbOperations } from '$lib/dbOperations'

/* eslint-disable require-await */
export const logDbOperations: DbOperations = {
  updateFirestoreDictionary: async (args) => { console.info({updateFirestoreDictionary: args}) },
  updateFirestoreEntry: async (args) => { console.info({updateFirestoreEntry: args})},
  updateSense: async (args) => { console.info({column: args.column, new_value: args.new_value, old_value: args.old_value, updateSense: args})},
}
