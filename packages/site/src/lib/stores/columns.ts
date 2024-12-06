import type { IColumn } from '@living-dictionaries/types'

export const defaultColumns: IColumn[] = [
  // field must match those used for i18n (e.g. lx = entry.lx)
  {
    field: 'lexeme',
    width: 170,
    sticky: true,
  },
  {
    field: 'audio',
    width: 31, // 50? // AudioCell
  },
  {
    field: 'photo',
    width: 31, // 50? // ImageCell
  },
  // TODO: add videos to columns
  // {
  //   field: 'videoFile',
  //   width: 31, // 50? // VideoCell
  // },
  {
    field: 'gloss',
    width: 250,
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
    width: 137, // SelectPOS
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
    width: 150, // SelectSpeakerCell
  },
  {
    field: 'tag',
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
    field: 'notes',
    width: 300,
  },
  {
    field: 'example_sentence',
    width: 300,
  },
  {
    field: 'sources',
    width: 200,
  },
]
