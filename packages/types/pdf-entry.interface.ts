export enum EntryPDFFieldsEnum {
  id = 'Id',
  in = 'Interlinearization',
  mr = 'Morphology',
  nc = 'Noun Class',
  pl = 'Plural Form',
  va = 'Variant',
  di = 'Dialect',
  nt = 'Notes',
  lo = '',
  lo2 = '',
  lo3 = '',
  lo4 = '',
  lo5 = '',
  ph = '',
  gl = '',
  ps = '',
  xv = '',
  xs = '',
  pf = '',
  sr = '',
  sd = '',
  sf = '',
  vfs = '',
  qr = '',
}
type EntryForPDFKeys = keyof typeof EntryPDFFieldsEnum;
export type ISelectedFields = {
  [key in EntryForPDFKeys]?: boolean;
};
