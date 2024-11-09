import type { EntryView } from '@living-dictionaries/types'
import { type Orama, type SearchParams as OramaSearchParams, create, insertMultiple, load, remove, search, update } from '@orama/orama'
import { expose } from 'comlink'
import type { QueryParams } from './types'
import { augment_entry_for_search } from './augment-entry-for-search'
import { entries_index_schema } from './entries-schema'

type EntriesIndex = Orama<typeof entries_index_schema>

let orama_index: Record<string, EntriesIndex>

async function create_index(entries: EntryView[], dictionary_id: string) {
  console.time('Augment Entries Time')
  const entries_augmented_for_search = entries.map(augment_entry_for_search)
  console.timeEnd('Augment Entries Time')

  console.time('Index Entries Time')
  const new_index = create({ schema: entries_index_schema })
  await insertMultiple(new_index, entries_augmented_for_search)
  orama_index = { [dictionary_id]: new_index }
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

// async function update_index_entries(entries: EntryView[]) {
//   const index = await get_index()
//   await updateMultiple(index, entries.map(({ id }) => id), entries.map(augment_entry_for_search))
// }

async function update_index_entry(entry: EntryView, dictionary_id: string) {
  const index = await get_index(dictionary_id)
  if (entry.deleted)
    await remove(index, entry.id)
  else
    await update(index, entry.id, augment_entry_for_search(entry))
}

export interface SearchEntriesOptions {
  query_params: QueryParams
  page_index: number
  entries_per_page: number
  dictionary_id?: string
}

async function search_entries({ query_params, entries_per_page, page_index, dictionary_id }: SearchEntriesOptions) {
  console.info('searching for', query_params.query)
  const index = await get_index(dictionary_id)

  const lexemeSortBy = (a, b) => {
    const a_lx = a[2]._lexeme[0] || 'zz'
    const b_lx = b[2]._lexeme[0] || 'zz'
    return a_lx.localeCompare(b_lx)
  }

  const onondagaSortBy = (a, b) => {
    const a_id = a[2].elicitation_id || 'zz'
    const b_id = b[2].elicitation_id || 'zz'
    if (a_id !== b_id)
      return a_id?.localeCompare(b_id)
    return a[2].lexeme?.localeCompare(b[2].lexeme)
  }

  const sortBy = dictionary_id === 'onondaga' ? onondagaSortBy : lexemeSortBy

  const orama_search_params: OramaSearchParams<Orama<typeof entries_index_schema>> = {
    term: query_params.query,
    limit: entries_per_page,
    offset: page_index * entries_per_page,
    tolerance: query_params.tolerance || 1, // Levenshtein edit distance from 'help' to 'holds' is 3 for example (change 2 letters and add 1), https://docs.orama.com/open-source/usage/search/introduction#typo-tolerance
    boost: {
      _lexeme: 6,
      _glosses: 2,
    },
    // threshold: 0.8,
    ...query_params.query ? { } : { sortBy },
    facets: { // to generate applicable filters options in the side menu
      _dialects: {
        limit: 10,
      },
      _parts_of_speech: {
        limit: 100,
      },
      _semantic_domains: {
        limit: 100,
      },
      _speakers: {
        limit: 100,
      },
      has_audio: {
        true: true,
        false: true,
      },
      has_image: {
        true: true,
        false: true,
      },
      has_video: {
        true: true,
        false: true,
      },
      has_speaker: {
        true: true,
        false: true,
      },
      has_noun_class: {
        true: true,
        false: true,
      },
      has_plural_form: {
        true: true,
        false: true,
      },
      has_part_of_speech: {
        true: true,
        false: true,
      },
      has_semantic_domain: {
        true: true,
        false: true,
      },
    },
    where: { // to actually filter
      ...query_params.dialects ? { _dialects: query_params.dialects } : {},
      ...query_params.parts_of_speech ? { _parts_of_speech: query_params.parts_of_speech } : {},
      ...query_params.semantic_domains ? { _semantic_domains: query_params.semantic_domains } : {},
      ...query_params.speakers ? { _speakers: query_params.speakers } : {},
      ...(query_params.has_image || query_params.view === 'gallery') ? { has_image: true } : {},
      ...(query_params.no_image && query_params.view !== 'gallery') ? { has_image: false } : {},
      ...query_params.has_audio ? { has_audio: true } : {},
      ...query_params.no_audio ? { has_audio: false } : {},
      ...query_params.has_video ? { has_video: true } : {},
      ...query_params.no_video ? { has_video: false } : {},
      ...query_params.has_speaker ? { has_speaker: true } : {},
      ...query_params.no_speaker ? { has_speaker: false } : {},
      ...query_params.has_noun_class ? { has_noun_class: true } : {},
      ...query_params.no_noun_class ? { has_noun_class: false } : {},
      ...query_params.has_plural_form ? { has_plural_form: true } : {},
      ...query_params.no_plural_form ? { has_plural_form: false } : {},
      ...query_params.has_part_of_speech ? { has_part_of_speech: true } : {},
      ...query_params.no_part_of_speech ? { has_part_of_speech: false } : {},
      ...query_params.has_semantic_domain ? { has_semantic_domain: true } : {},
      ...query_params.no_semantic_domain ? { has_semantic_domain: false } : {},
    },
  }

  return await search(index, orama_search_params)
}

export const api = {
  create_index,
  // update_index_entries,
  update_index_entry,
  search_entries,
  load_cached_index,
}

expose(api)
