export type View = 'list' | 'table' | 'print' | 'gallery'

/** Which index the unified search box targets. Absent = words (entries). */
export type SearchScope = 'sentences' | 'texts'

export interface QueryParams {
  page: number
  query: string
  scope?: SearchScope
  entries_per_page?: number
  view?: View
  tolerance?: number
  // Array facets
  orthographies?: string[]
  sources?: string[]
  tags?: string[]
  dialects?: string[]
  parts_of_speech?: string[]
  semantic_domains?: string[]
  speakers?: string[]
  // Boolean facets
  has_audio?: boolean
  no_audio?: boolean
  has_sentence?: boolean
  no_sentence?: boolean
  has_image?: boolean
  no_image?: boolean
  has_video?: boolean
  no_video?: boolean
  has_speaker?: boolean
  no_speaker?: boolean
  has_noun_class?: boolean
  no_noun_class?: boolean
  has_plural_form?: boolean
  no_plural_form?: boolean
  has_part_of_speech?: boolean
  no_part_of_speech?: boolean
  has_semantic_domain?: boolean
  no_semantic_domain?: boolean
  // Sentence-scope facets (see corpus-schemas.ts; has_audio/has_image/has_video reused from above)
  in_text?: boolean
  standalone?: boolean
  has_translation?: boolean
  no_translation?: boolean
}

type ArrayFilters = 'orthographies' | 'sources' | 'tags' | 'dialects' | 'parts_of_speech' | 'semantic_domains' | 'speakers'
export type FilterListKeys = ArrayFilters & keyof QueryParams

// type StoreValue<T> = T extends { subscribe: (run: (value: infer R) => void) => Unsubscriber } ? R : never
