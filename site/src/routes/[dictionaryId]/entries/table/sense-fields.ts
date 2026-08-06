import type { EntryFieldValue } from '$lib/types'

/** Columns whose value belongs to a sense — these get one row per sense; all other
 *  columns are entry-level and span the entry's sense rows via rowspan. */
export const SENSE_FIELDS = new Set<EntryFieldValue>([
  'photo',
  'video',
  'gloss',
  'definition',
  'parts_of_speech',
  'semantic_domains',
  'noun_class',
  'plural_form',
  'variant',
  'example_sentence',
  'sense_sources',
])
