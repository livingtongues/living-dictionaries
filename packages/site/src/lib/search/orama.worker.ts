import { create, insertMultiple, remove, update } from '@orama/orama'
import { expose } from 'comlink'
import type { EntryData } from '@living-dictionaries/types'
import { augment_entry_for_search } from './augment-entry-for-search'
import { type EntriesIndex, entries_index_schema } from './entries-schema'
import { type SearchEntriesOptions, search_entries } from './search-entries'
import { createMultilingualTokenizer } from './multilingual-tokenizer'

let orama_index: Record<string, EntriesIndex>

async function create_index(entries: EntryData[], dictionary_id: string) {
  console.time('Augment Entries Time')
  const entries_augmented_for_search = entries.map(augment_entry_for_search)
  console.timeEnd('Augment Entries Time')

  console.time('Index Entries Time')
  const index = create({
    schema: entries_index_schema,
    components: { tokenizer: createMultilingualTokenizer() },
  })
  await insertMultiple(index, entries_augmented_for_search)
  orama_index = { [dictionary_id]: index }
  console.timeEnd('Index Entries Time')
}

function get_index(dictionary_id: string): Promise<EntriesIndex> {
  return new Promise((resolve) => {
    const index = orama_index?.[dictionary_id]
    if (index) return resolve(index)

    const interval = setInterval(() => {
      const index = orama_index?.[dictionary_id]
      if (index) {
        clearInterval(interval)
        resolve(index)
      }
    }, 50)
  })
}

// async function update_index_entries(entries: EntryData[]) {
//   const index = await get_index()
//   await updateMultiple(index, entries.map(({ id }) => id), entries.map(augment_entry_for_search))
// }

async function update_index_entry(entry: EntryData, dictionary_id: string) {
  const index = await get_index(dictionary_id)
  if (entry.deleted)
    await remove(index, entry.id)
  else
    await update(index, entry.id, augment_entry_for_search(entry))
}

async function _search_entries(options: SearchEntriesOptions) {
  const index = await get_index(options.dictionary_id)
  return search_entries(options, index)
}

export const api = {
  create_index,
  update_index_entry,
  search_entries: _search_entries,
}

expose(api)
