import type { Orama } from '@orama/orama'

export type EntriesIndex = Orama<typeof entries_index_schema>

export const entries_index_schema = {
  _lexeme: 'string[]', // all orthographies as they are and a simplified version (diacritics stripped and ipa characters replaced with common keyboard characters to make easier to type)
  _glosses: 'string[]', // includes all glosses for all senses
  // _sentences: 'string[]', // includes all sentences in all languages for all senses
  _other: 'string[]', // phonetic, notes, scientific_names, sources, interlinearization,morphology, plural_form,

  // Filters
  _dialects: 'string[]', // underscored
  _parts_of_speech: 'string[]', // augmented
  _semantic_domains: 'string[]', // augmented
  _speakers: 'string[]', // augmented
  has_audio: 'boolean',
  has_image: 'boolean',
  has_video: 'boolean',
  has_speaker: 'boolean',
  has_noun_class: 'boolean',
  has_plural_form: 'boolean',
  has_part_of_speech: 'boolean',
  has_semantic_domain: 'boolean',
} as const
