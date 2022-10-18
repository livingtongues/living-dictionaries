export enum CustomPrintFields {
  // lx always shows
  alternateOrthographies = 'Alternate Orthographies',
  ph = 'Phonetic',
  gloss = 'Glosses',
  ps = 'Part of Speech',
  example_sentence = 'Example Sentences',
  image = 'Image',
  speaker = 'Speaker',
  sr = 'Source',
  sdn = 'Semantic Domains',
}

// displayed with labels, no custom logic
export enum StandardPrintFields {
  in = 'Interlinearization',
  mr = 'Morphology',
  nc = 'Noun Class',
  pl = 'Plural Form',
  va = 'Variant',
  di = 'Dialect',
  nt = 'Notes',
  id = 'Id',
}

type PrintFieldKeys = keyof typeof CustomPrintFields | keyof typeof StandardPrintFields;
export type IPrintFields = {
  [key in PrintFieldKeys]?: boolean;
};
