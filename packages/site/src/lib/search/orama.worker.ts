import type { ExpandedEntry } from '@living-dictionaries/types';
import { create, insertMultiple, search, type Orama, type SearchParams as OramaSearchParams } from '@orama/orama'
import { expose } from 'comlink'
import type { QueryParams } from './types';
import { augment_entry_for_search } from './augment-entry-for-search';

const entries_index_schema = {
  lexeme: 'string',
  lexeme_other: 'string[]', // includes local orthographies; includes lexeme with diacritics stripped and ipa characters replaced with common keyboard characters to make easier to type
  glosses: 'string[]', // includes all glosses for all senses
  sentences: 'string[]', // includes all sentences in all languages for all senses
  phonetic: 'string',
  notes: 'string',
  scientific_names: 'string[]',
  sources: 'string[]',
  interlinearization: 'string',
  morphology: 'string',
  plural_form: 'string',
  // Filters
  dialects: 'string[]',
  parts_of_speech: 'string[]', // augmented
  semantic_domains: 'string[]', // augmented
  speakers: 'string[]', // augmented
  has_audio: 'boolean',
  has_image: 'boolean',
  has_video: 'boolean',
  has_speaker: 'boolean',
  has_noun_class: 'boolean',
  has_plural_form: 'boolean',
  has_part_of_speech: 'boolean',
  has_semantic_domain: 'boolean',
} as const

let orama_index: Orama<typeof entries_index_schema>

async function create_index(entries: Map<string, ExpandedEntry>) {
  console.time('Augment Entries Time');
  const entriesArray = Array.from(entries.values());
  const entries_augmented_for_search = entriesArray.map(augment_entry_for_search)
  console.timeEnd('Augment Entries Time');

  console.time('Index Entries Time');
  const new_index = await create({ schema: entries_index_schema })
  await insertMultiple(new_index, entries_augmented_for_search)
  orama_index = new_index
  console.timeEnd('Index Entries Time');
}

function get_index(): Promise<typeof orama_index> {
  return new Promise(resolve => {
    if (orama_index) return resolve(orama_index)

    const interval = setInterval(() => {
      if (orama_index) {
        clearInterval(interval)
        resolve(orama_index)
      }
    }, 50)
  })
}

async function search_entries(query_params: QueryParams, page_index: number, entries_per_page: number) {
  console.info('searching for', query_params.query)
  const index = await get_index()

  const orama_search_params: OramaSearchParams<Orama<typeof entries_index_schema>> = {
    term: query_params.query,
    limit: entries_per_page,
    offset: page_index * entries_per_page,
    threshold: 2, // Levenshtein edit distance from 'help' to 'holds' is 3 for example (change 2 letters and add 1)
    boost: {
      lexeme: 2,
      lexeme_other: 1.5,
      glosses: 1.2,
    },
    sortBy: {
      property: 'lexeme',
    },
    // Onondaga sortBy possibility
    // sortBy: (a, b) => {
    //   return a[2].elicitation_id - b[2].elicitation_id
    // },
    facets: {
      dialects: {
        limit: 10,
      },
      parts_of_speech: {
        limit: 100,
      },
      semantic_domains: {
        limit: 100,
      },
      speakers: {
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
    where: {
      ...query_params.dialects ? { dialects: query_params.dialects }: {},
      ...query_params.parts_of_speech ? { parts_of_speech: query_params.parts_of_speech }: {},
      ...query_params.semantic_domains ? { semantic_domains: query_params.semantic_domains }: {},
      ...query_params.speakers ? { speakers: query_params.speakers }: {},
      ...query_params.has_image ? { has_image: true }: {},
      ...query_params.no_image ? { has_image: false }: {},
      ...query_params.has_audio ? { has_audio: true }: {},
      ...query_params.no_audio ? { has_audio: false }: {},
      ...query_params.has_video ? { has_video: true }: {},
      ...query_params.no_video ? { has_video: false }: {},
      ...query_params.has_speaker ? { has_speaker: true }: {},
      ...query_params.no_speaker ? { has_speaker: false }: {},
      ...query_params.has_noun_class ? { has_noun_class: true }: {},
      ...query_params.no_noun_class ? { has_noun_class: false }: {},
      ...query_params.has_plural_form ? { has_plural_form: true }: {},
      ...query_params.no_plural_form ? { has_plural_form: false }: {},
      ...query_params.has_part_of_speech ? { has_part_of_speech: true }: {},
      ...query_params.no_part_of_speech ? { has_part_of_speech: false }: {},
      ...query_params.has_semantic_domain ? { has_semantic_domain: true }: {},
      ...query_params.no_semantic_domain ? { has_semantic_domain: false }: {},
    },
  }

  return await search(index, orama_search_params)
}

export const api = {
  create_index,
  search_entries,
}

expose(api)
