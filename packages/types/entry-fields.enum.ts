// Primary purpose is to give a readable way to dispatch database updates, the left is the readable, the right is the database value
export enum EntryFields {
  'lexeme' = 'lx',
  'phonetic' = 'ph',
  'notes' = 'nt',
  'interlinearization' = 'in',
  'morphology' = 'mr',
  'plural_form' = 'pl',
  'gloss' = 'gloss',
  'example_sentence' = 'example_sentence',
  'local_orthography' = 'alternateOrthographies',
  'scientific_names' = 'scn',
  'noun_class' = 'nc',
  'dialects' = 'di',
  'variant' = 'va',
  'sources' = 'sr',
  'elicitation_id' = 'ei',
  'parts_of_speech' = 'ps',
  'semantic_domains' = 'sdn',
  'speaker' = 'speaker',
  'definition_english' = 'de', // only Bahasa Lani
  'photo' = 'pf',
  'audio' = 'sf',
}


export type EntryFieldValue = keyof typeof EntryFields;
// export type EntryFieldKey = `${EntryFields}`;

// i18n keys are `entry_field.${EntryFieldValue}` (using the left column values)
