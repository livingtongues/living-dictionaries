import type { Variants } from 'kitbook';
import type Component from './EntryDisplay.svelte';
import type { IDictionary } from '@living-dictionaries/types';

const dictionary: IDictionary = {
  name: 'Banange',
  glossLanguages: ['en', 'es'],
};

export const variants: Variants<Component> = [
  {
    name: 'Scientific Name',
    props: {
      entry: {
        lx: 'Old world swallowtail',
        scn: ['Papilio machaon'],
      },
      dictionary,
    },
  },
  {
    name: 'Scientific Name',
    description: 'Partial italics, can edit',
    props: {
      entry: {
        lx: 'Old world swallowtail',
        scn: ['<i>Papilio machaon</i>, Dr. G.'],
      },
      dictionary,
      canEdit: true,
    },
  },
  {
    name: 'No details, can edit',
    height: 600,
    props: {
      entry: {
        lx: 'foo'
      },
      dictionary,
      canEdit: true,
    },
  },
];
