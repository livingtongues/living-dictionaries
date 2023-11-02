import type { Variant } from 'kitbook';
import type Component from './PrintEntry.svelte';
import type { IPrintFields } from '@living-dictionaries/types';
import { complex, simple } from '$lib/mocks/entries';
import { basic_mock_dictionary } from '$lib/mocks/dictionaries';

const selectedFields: IPrintFields = {
  gloss: true,
  alternateOrthographies: true,
  ph: true,
  ps: true,
  example_sentence: true,
  sdn: true,
  noun_class: true,
  interlinearization: true,
  morphology: true,
  plural_form: true,
  variant: true,
  dialects: true,
  notes: true,
  image: true,
  speaker: true,
  sr: true,
};

export const variants: Variant<Component>[] = [
  {
    name: 'complex',
    viewports: [{width: 400, height: 700}],
    props: {
      dictionary: basic_mock_dictionary,
      selectedFields,
      entry: complex,
      showQrCode: true,
      headwordSize: 20,
      showLabels: true,
    }
  },
  {
    name: 'simple',
    viewports: [{width: 400, height: 100}],
    languages: [],
    props: {
      dictionary: basic_mock_dictionary,
      selectedFields,
      entry: simple,
      headwordSize: 20,
    }
  }
]
