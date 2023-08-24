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
  'definition_english' = 'de', // only Bahasa Lani
  'parts_of_speech' = 'ps',
  'semantic_domains' = 'sdn',
  'speaker' = 'speaker',
  'photo' = 'pf',
  'audio' = 'sf',
}

export type EntryFieldValue = keyof typeof EntryFields;
// export type EntryFieldKey = `${EntryFields}`;
