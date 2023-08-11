import type { IPrintFields } from '@living-dictionaries/types';
import type { Variants } from 'kitbook';
import type Component from './PrintEntry.svelte';
import { mockEntries } from '$lib/mocks/entries';
import { expand_entry } from '$lib/transformers/expand_entry';

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

export const variants: Variants<Component> = mockEntries.map(variant => {
  return {
    name: variant.name,
    height: 400,
    // ...variant,
    props: {
      dictionary: {
        id: 'gta',
        name: 'Gtaʼ',
        glossLanguages: ['en', 'es'],
      },
      selectedFields,
      entry: expand_entry(variant.entry),
      showQrCode: true,
      headwordSize: 20,
      showLabels: true,
    }
  };
});
