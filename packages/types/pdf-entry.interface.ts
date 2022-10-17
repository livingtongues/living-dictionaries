export enum EntryPDFFieldsEnum {
  id = 'Id',
  in = 'Interlinearization',
  mr = 'Morphology',
  nc = 'Noun Class',
  pl = 'Plural Form',
  va = 'Variant',
  di = 'Dialect',
  nt = 'Notes',
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
export type PrintFieldKeys = keyof typeof EntryPDFFieldsEnum;
export type IPrintFields = {
  [key in PrintFieldKeys]?: boolean;
};
