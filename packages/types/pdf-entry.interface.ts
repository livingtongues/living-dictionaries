export enum EntryPDFFieldsEnum {
  // If initialized with value then the value will be the field label // too cryptic - only found this out by breaking things from adding labels for all fields
  id = 'Id',
  in = 'Interlinearization',
  mr = 'Morphology',
  nc = 'Noun Class',
  pl = 'Plural Form',
  va = 'Variant',
  di = 'Dialect',
  nt = 'Notes',
  alternateOrthographies = '',
  ph = '',
  gloss = '',
  ps = '',
  example_sentence = '',
  image = '',
  speaker = '',
  sr = '',
  sdn = '', // sd
}
type PrintFieldKeys = keyof typeof EntryPDFFieldsEnum;
export type IPrintFields = {
  [key in PrintFieldKeys]: boolean;
};

// export defaultPrintFields
