import type { Variants } from 'kitbook';
import type Component from './MultiSelectModal.svelte';
export const variants: Variants<Component> = [
  {
    height: 450,
    width: 700,
    props: {
      value: ['1.2'],
      placeholder: 'Select...',
      options: [
        { key: '1.2', name: 'Sky' },
        { key: '1.3', name: 'water' },
      ],
    }
  },
]