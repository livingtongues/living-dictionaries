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
