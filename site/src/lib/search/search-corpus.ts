import { search } from '@orama/orama'
import type { SearchParams as OramaSearchParams } from '@orama/orama'
import type { QueryParams } from './types'
import type { SentencesIndex, TextsIndex } from './corpus-schemas'

export interface SearchCorpusOptions {
  query_params: QueryParams
  page_index: number
  per_page: number
}

interface SortableDoc {
  _created_at?: string
}

/** Newest first when browsing without a query (sentences have no headword to alphabetize). */
function by_created_at_desc(a: [number, number, unknown], b: [number, number, unknown]) {
  const a_created = (a[2] as SortableDoc)._created_at || ''
  const b_created = (b[2] as SortableDoc)._created_at || ''
  return b_created.localeCompare(a_created)
}

export async function search_sentences({ query_params, per_page, page_index }: SearchCorpusOptions, index: SentencesIndex) {
  const orama_search_params: OramaSearchParams<SentencesIndex> = {
    term: query_params.query,
    limit: per_page,
    offset: page_index * per_page,
    tolerance: query_params.tolerance || 1,
    boost: {
      _text: 3,
      _translation: 1,
    },
    ...query_params.query ? {} : { sortBy: by_created_at_desc },
    facets: {
      in_text: { true: true, false: true },
      has_translation: { true: true, false: true },
      has_audio: { true: true, false: true },
      has_image: { true: true, false: true },
      has_video: { true: true, false: true },
      _sources: { limit: 50 },
    },
    where: {
      // `in_text`/`standalone` are the two halves of one 3-state filter (both unset = all)
      ...query_params.in_text ? { in_text: true } : {},
      ...query_params.standalone ? { in_text: false } : {},
      ...query_params.sources ? { _sources: query_params.sources } : {},
      ...query_params.has_translation ? { has_translation: true } : {},
      ...query_params.no_translation ? { has_translation: false } : {},
      ...query_params.has_audio ? { has_audio: true } : {},
      ...query_params.no_audio ? { has_audio: false } : {},
      ...query_params.has_image ? { has_image: true } : {},
      ...query_params.no_image ? { has_image: false } : {},
      ...query_params.has_video ? { has_video: true } : {},
      ...query_params.no_video ? { has_video: false } : {},
    },
  }

  return await search(index, orama_search_params)
}

export async function search_texts({ query_params, per_page, page_index }: SearchCorpusOptions, index: TextsIndex) {
  const orama_search_params: OramaSearchParams<TextsIndex> = {
    term: query_params.query,
    limit: per_page,
    offset: page_index * per_page,
    tolerance: query_params.tolerance || 1,
    ...query_params.query ? {} : { sortBy: by_created_at_desc },
  }

  return await search(index, orama_search_params)
}
