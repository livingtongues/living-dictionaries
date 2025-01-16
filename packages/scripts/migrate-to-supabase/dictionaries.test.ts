import type { IDictionary } from '@living-dictionaries/types'
import { generate_dictionary_inserts } from './dictionaries'
import firebase_dictionaries from './firestore-data/firestore-dictionaries.json'

test(generate_dictionary_inserts, () => {
  expect(generate_dictionary_inserts(firebase_dictionaries.slice(0, 1) as IDictionary[])).toMatchInlineSnapshot()
})
