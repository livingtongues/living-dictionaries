// Primary purpose is to give a readable way to dispatch database updates, the left is the readable, the right is the database value
// Secondary purpose is i18n entry field keys
export enum EntryFields {
  lexeme = 'lx',
  phonetic = 'ph',
  notes = 'nt',
  interlinearization = 'in',
  morphology = 'mr',
  plural_form = 'pl',
  gloss = 'gloss', // not actual db value
  example_sentence = 'example_sentence', // not actual db value
  local_orthography = 'alternateOrthographies', // not actual db value
  scientific_names = 'scn',
  noun_class = 'nc',
  dialects = 'di',
  variant = 'va',
  sources = 'sr',
  elicitation_id = 'ei',
  parts_of_speech = 'ps',
  semantic_domains = 'sdn',
  speaker = 'speaker',
  definition_english = 'de', // only Bahasa Lani
  photo = 'pf',
  audio = 'sf',
  coordinates = 'co', // not known in i18n
}

export type EntryFieldValue = keyof typeof EntryFields
// export type EntryFieldKey = `${EntryFields}`;

export type i18nEntryFieldKey = `entry_field.${Exclude<EntryFieldValue, 'coordinates'>}`
