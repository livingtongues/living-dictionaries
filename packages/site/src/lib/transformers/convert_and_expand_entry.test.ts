import type { ActualDatabaseEntry, ExpandedEntry, GoalDatabaseEntry } from '@living-dictionaries/types'
import { convert_and_expand_entry } from './convert_and_expand_entry'

vi.mock('sveltefirets', () => {
  return {
    firebaseConfig: {
      storageBucket: 'test-bucket',
    },
  }
})

describe(convert_and_expand_entry, () => {
  test('updates entry to goal database shape and expands for UI while keeping old database shape (actual database) until UI is refactored to use expanded shape', () => {
    const entry: ActualDatabaseEntry = {
      lo: 'lo1', // old shape
      lo2: 'lo2', // current shape
    }
    // @ts-expect-error - TODO: can we remove ...entry?
    const expected: GoalDatabaseEntry & ExpandedEntry = {
      ...entry,
      lo1: 'lo1', // current shape for lo
      local_orthography_1: 'lo1',
      local_orthography_2: 'lo2',
      senses: [{}],
    }
    expect(convert_and_expand_entry(entry, () => '')).toEqual(expected)
  })
})
