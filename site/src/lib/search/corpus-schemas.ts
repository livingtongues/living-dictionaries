import type { Orama } from '@orama/orama'

export type SentencesIndex = Orama<typeof sentences_index_schema>
export type TextsIndex = Orama<typeof texts_index_schema>

/**
 * Sentence docs for the corpus scope of the unified search (one doc per
 * `sentences` row — standalone example sentences AND text sentences). Docs also
 * carry unindexed `_created_at`/`_sort_key`/`_text_id` for sorting/rendering.
 */
export const sentences_index_schema = {
  _text: 'string[]', // sentence text in all orthographies (tokenizer adds simplified forms)
  _translation: 'string[]', // all translation locales

  // Filters
  in_text: 'boolean', // true = belongs to a text; false = standalone (incl. legacy example sentences)
  has_translation: 'boolean',
  has_audio: 'boolean',
  has_image: 'boolean',
  has_video: 'boolean',
  _sources: 'string[]', // source slugs (facet-only; labels resolved from page.data.sources)
} as const

/** Text docs — a dictionary has dozens of texts, so title matching is enough. */
export const texts_index_schema = {
  _title: 'string[]', // title in all languages
} as const
