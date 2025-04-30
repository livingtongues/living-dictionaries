import { create, insertMultiple, load, remove, update } from '@orama/orama'
import { expose } from 'comlink'
import { augment_entry_for_search } from './augment-entry-for-search'
import { type EntriesIndex, entries_index_schema } from './entries-schema'
import { type SearchEntriesOptions, search_entries } from './search-entries'
import { createMultilingualTokenizer } from './multilingual-tokenizer'
import type { EntryData } from './types'

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

async function load_cached_index(dictionary_id: string) {
  const url = `https://index.livingdictionaries.app/indexes/${dictionary_id}.json`
  try {
    console.info('loading cached index')
    const response = await fetch(url)
    if (!response.ok) {
      console.info('cached index not found')
      return
    }
    const serialized_json = await response.text()
    console.info('got cached index')
    const deserialized = JSON.parse(serialized_json)
    console.info('parsed cached index')
    const cached_index = create({ schema: entries_index_schema })
    load(cached_index, deserialized)
    console.info('loaded cached index')

    if (!orama_index?.[dictionary_id]) {
      orama_index = { [dictionary_id]: cached_index }
      console.info('Search index loaded Clouflare')
    }
  } catch (err) {
    console.error('Error loading cached index', err)
  }
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
  load_cached_index,
}

expose(api)
