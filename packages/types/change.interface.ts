type FieldOptions =
  'photo' | 'audio' | 'speaker' | 'lexeme' | 'elicitation_id' |
  'morphology' | 'local_orthography' | 'semantic_domains' |
  'parts_of_speech' | 'phonetic' | 'dialects' | 'interlinearization' |
  'notes' | 'sources' | 'example_sentence' | 'noun_class' |
  'variant' | 'gloss' | 'plural_form' | 'scientific_names'

export interface Change {
  updatedBy: string
  updatedName: string
  entryId: string
  entryName: string
  dictionaryId: string
  dictionaryName: string
  previousValue: string | string[]
  currentValue: string | string[]
  field: FieldOptions
  updatedAtMs: number
}
