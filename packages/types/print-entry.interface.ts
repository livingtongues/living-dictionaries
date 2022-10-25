export enum CustomPrintFields {
  // lx always shows and is not toggleable
  gloss = 'Glosses', // always show toggle
  alternateOrthographies = 'Alternate Orthographies', // lo, lo2, lo3, lo4, lo5
  ph = 'Phonetic', // same as entry field
  ps = 'Part of Speech', // same as entry field
  example_sentence = 'Example Sentences', // xv or xs
  sdn = 'Semantic Domains', // sdn || sd
  image = 'Image', // pf.gcs
  speaker = 'Speaker', // sf.sp or sf.speakerName
  sr = 'Source', // same as entry field
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
