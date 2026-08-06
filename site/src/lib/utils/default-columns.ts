import type { IColumn } from '$lib/types'

export const default_columns: IColumn[] = [
  // field must match those used for i18n (e.g. lx = entry.lx)
  {
    field: 'lexeme',
    width: 170,
    sticky: true,
  },
  {
    field: 'homograph',
    width: 80,
    hidden: true,
  },
  {
    field: 'audio',
    width: 44,
  },
  {
    field: 'photo',
    width: 56,
  },
  {
    field: 'video',
    width: 56,
  },
  {
    field: 'gloss',
    width: 250,
  },
  {
    field: 'definition',
    width: 300,
  },
  {
    field: 'local_orthography',
    width: 170,
  },
  {
    field: 'elicitation_id',
    width: 90,
  },
  {
    field: 'semantic_domains',
    width: 200,
  },
  {
    field: 'parts_of_speech',
    width: 137,
  },
  {
    field: 'noun_class',
    width: 150,
  },
  {
    field: 'phonetic',
    width: 170,
  },
  {
    field: 'speaker',
    width: 150,
  },
  {
    field: 'custom_tags',
    width: 130,
  },
  {
    field: 'dialects',
    width: 130,
  },
  {
    field: 'interlinearization',
    width: 150,
  },
  {
    field: 'morphology',
    width: 150,
  },
  {
    field: 'scientific_names',
    width: 150,
  },
  {
    field: 'plural_form',
    width: 150,
  },
  {
    // hidden is per-dictionary when unset — see set_up_columns
    field: 'variant',
    width: 150,
  },
  {
    field: 'notes',
    width: 300,
  },
  {
    field: 'linguistic_history',
    width: 300,
  },
  {
    field: 'example_sentence',
    width: 300,
  },
  {
    field: 'sense_sources',
    width: 200,
    hidden: true,
  },
  {
    field: 'sources',
    width: 200,
  },
  {
    field: 'coordinates',
    width: 60,
    hidden: true,
  },
]
