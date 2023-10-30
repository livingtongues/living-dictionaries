import type { Variant, Viewport } from 'kitbook';
import type Component from './EntryPartOfSpeech.svelte';

export const viewports: Viewport[] = [
  { width: 400, height: 200}
]

export const variants: Variant<Component>[] = [
  {
    name: 'cannot edit',
    props: {
      value: ['n', 'v'],
    }
  },
  {
    name: 'can edit',
    props: {
      canEdit: true,
      value: ['n', 'v'],
    }
  },
  {
    name: 'undefined - can edit',
    props: {
      canEdit: true,
      value: undefined,
    }
  },
  {
    name: 'handles string',
    props: {
      value: 'foo' as unknown as [],
    }
  }
]
