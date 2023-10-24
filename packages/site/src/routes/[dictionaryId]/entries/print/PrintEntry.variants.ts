import type { Variant } from 'kitbook';
import type Component from './PrintEntry.svelte';
import type { IPrintFields } from '@living-dictionaries/types';
import { mock_expanded_entries } from '$lib/mocks/entries';
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

export const variants: Variant<Component>[] = mock_expanded_entries.map(variant => {
  return {
    name: variant.name,
    height: 400,
    props: {
      dictionary: basic_mock_dictionary,
      selectedFields,
      entry: variant.entry,
      showQrCode: true,
      headwordSize: 20,
      showLabels: true,
    }
  };
});
