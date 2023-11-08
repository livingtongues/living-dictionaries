// these values are never used - this could be simplified to not use enums

enum CustomPrintFields {
  // lexeme always shows
  gloss = 'Glosses',
  local_orthography = 'Alternate Orthographies', // lo, lo2, lo3, lo4, lo5
  phonetic = 'Phonetic',
  parts_of_speech = 'Part of Speech',
  example_sentence = 'Example Sentences', // xv or xs
  semantic_domains = 'Semantic Domains', // sdn || sd
  photo = 'Photo', // pf.gcs
  speaker = 'Speaker', // sf.sp or sf.speakerName
  sources = 'Source',
  noun_class = 'Noun Class',
}

// displayed with labels, no custom logic
export enum StandardPrintFields {
  interlinearization = 'Interlinearization',
  morphology = 'Morphology',
  plural_form = 'Plural Form',
  variant = 'Variant',
  dialects = 'Dialects',
  notes = 'Notes',
}

type PrintFieldKeys = keyof typeof CustomPrintFields | keyof typeof StandardPrintFields;

export type IPrintFields = {
  [key in PrintFieldKeys]?: boolean;
};
