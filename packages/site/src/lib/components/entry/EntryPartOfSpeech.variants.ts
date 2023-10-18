import type { Variant } from 'kitbook';
import type Component from './EntryPartOfSpeech.svelte';
export const variants: Variant<Component>[] = [
  {
    name: 'arrays',
    props: {
      value: ['n', 'v'],
    }
  },
]
