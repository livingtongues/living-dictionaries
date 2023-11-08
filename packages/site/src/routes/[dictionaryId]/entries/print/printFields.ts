import type { IPrintFields } from '@living-dictionaries/types';

export const defaultPrintFields: IPrintFields = {
  gloss: true,
  local_orthography: true,
  phonetic: true,
  parts_of_speech: true,
  example_sentence: true,
  semantic_domains: false,
  interlinearization: false,
  morphology: false,
  noun_class: false,
  plural_form: false,
  variant: false,
  dialects: false,
  notes: false,
  photo: false,
  speaker: false,
  sources: false,
};
