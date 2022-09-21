export enum EntryPDFFieldsEnum {
  id = 'Id',
  in = 'Interlinearization',
  mr = 'Morphology',
  nc = 'Noun Class',
  pl = 'Plural Form',
  va = 'Variant',
  di = 'Dialect',
  nt = 'Notes',
  lo = 'Local Orthography 1',
  lo2 = 'Local Orthography 2',
  lo3 = 'Local Orthography 3',
  lo4 = 'Local Orthography 4',
  lo5 = 'Local Orthography 5',
  ph = 'Phonetic',
  gloss = 'Glosses',
  ps = 'Part of Speech',
  xv = 'Example Sentence (Vernacular)',
  xs = 'Example Sentence',
  image = 'Image',
  speaker = 'Speaker',
  sr = 'Source',
  sdn = 'Semantic Domains',
}
type PrintFieldKeys = keyof typeof EntryPDFFieldsEnum;
export type IPrintFields = {
  [key in PrintFieldKeys]: boolean;
};

// export defaultPrintFields
