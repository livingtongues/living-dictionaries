import type { DbOperations } from '$lib/dbOperations'

/* eslint-disable require-await */
export const logDbOperations: DbOperations = {
  updateFirestoreEntry: async (args) => { console.info({updateFirestoreEntry: args})},
  update_sense: async (args) => { console.info({column: args.column, new_value: args.new_value, old_value: args.old_value, update_sense: args})},
  update_sentence: async (args) => { console.info(args) }
}
