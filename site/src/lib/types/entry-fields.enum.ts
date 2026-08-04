enum EntryFields {
  lexeme = 'lx',
  homograph = 'hm',
  phonetic = 'ph',
  notes = 'nt',
  linguistic_history = 'lh',
  interlinearization = 'in',
  morphology = 'mr',
  plural_form = 'pl',
  gloss = 'gloss', // not actual db value
  example_sentence = 'example_sentence', // not actual db value
  local_orthography = 'alternateOrthographies', // not actual db value
  scientific_names = 'scn',
  noun_class = 'nc',
  custom_tags = 'tag', // not sure if these right side values are used anymore?
  dialects = 'di',
  variant = 'va',
  sources = 'sr',
  sense_sources = 'sense_sources', // not actual db value — senses.sources in the table
  video = 'video', // not actual db value
  elicitation_id = 'ei',
  parts_of_speech = 'ps',
  semantic_domains = 'sdn',
  speaker = 'speaker',
  definition = 'de',
  photo = 'pf',
  audio = 'sf',
  coordinates = 'co',
  ID = 'id', // not i18n required
}

export type EntryFieldValue = keyof typeof EntryFields
// export type EntryFieldKey = `${EntryFields}`;

export type i18nEntryFieldKey = `entry_field.${Exclude<EntryFieldValue, 'ID'>}`
