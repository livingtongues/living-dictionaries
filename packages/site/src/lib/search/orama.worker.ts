import type { ExpandedEntry } from '@living-dictionaries/types';
import { create, insertMultiple, search, type Orama, type SearchParams as OramaSearchParams } from '@orama/orama'
import { expose } from 'comlink'
import type { QueryParams } from './types';

const entries_index_schema = {
  lexeme: 'string',
  notes: 'string',
  has_audio: 'boolean',
  has_image: 'boolean',
  has_video: 'boolean',
  // has_speaker: 'boolean',
} as const

let orama_index: Orama<typeof entries_index_schema>

async function create_index(entries: ExpandedEntry[]) {
  console.time('Augment Entries Time');

  const entries_augmented_for_search = entries.map(entry => {
    return {
      ...entry,
      has_audio: !!entry.sound_files?.length,
      has_image: !!entry.senses[0]?.photo_files?.length,
      has_video: !!entry.senses[0]?.video_files?.length,
      // has_speaker: !!entry.sound_files,
    }
  })

  console.timeEnd('Augment Entries Time');
  console.time('Index Entries Time');

  const new_index = await create({
    schema: entries_index_schema
  })

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

  // const where: Partial<WhereCondition<typeof entries_index_schema>> = {}

  const orama_search_params: OramaSearchParams<Orama<typeof entries_index_schema>> = {
    term: query_params.query,
    limit: entries_per_page,
    offset: page_index * entries_per_page,
    boost: {
      lexeme: 2,
    },
    facets: {
      has_audio: {
        true: true,
        false: true,
      },
      has_image: {
        true: true,
        false: true,
      },
    },
    where: {
      ...query_params.has_image ? { has_image: true }: {},
      ...query_params.no_image ? { has_image: false }: {},
      ...query_params.has_audio ? { has_audio: true }: {},
      ...query_params.no_audio ? { has_audio: false }: {},
      ...query_params.has_video ? { has_video: true }: {},
      ...query_params.no_video ? { has_video: false }: {},
    },
    sortBy: {
      property: 'lexeme',
    },
    threshold: 0.7, // 0-1 (1 default = 100% of related matches will also be returned, 0 = 0% of non-exact matches will be returned)
  }

  return await search(index, orama_search_params)
}

export const api = {
  create_index,
  search_entries,
}

expose(api)
