import type { Variant, Viewport } from 'kitbook';
import type Component from './EntryPartOfSpeech.svelte';

export const viewports: Viewport[] = [
  { width: 300, height: 50}
]

export const variants: Variant<Component>[] = [
  {
    name: 'can edit',
    props: {
      canEdit: true,
      value: ['n', 'v'],
    },
    viewports: [
      { width: 400, height: 300}
    ]
  },
  {
    name: 'cannot edit',
    props: {
      value: ['n', 'v'],
    },
    languages: [],
  },
  {
    name: 'undefined - can edit',
    props: {
      canEdit: true,
      value: undefined,
    },
    languages: [],
  },
]
