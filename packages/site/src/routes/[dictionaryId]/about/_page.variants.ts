import type { Variants } from 'kitbook';
import type Component from './+page.svelte';
import { readable } from 'svelte/store';
export const variants: Variants<Component> = [
  {
    name: 'View',
    props: {
      data: {
        dictionary: {
          name: 'test',
          glossLanguages: []
        },
        user: null,
        isManager: readable(false),
        about: 'This dictionary has interesting verb morphology...',
      },
    },
  },
  {
    name: 'Edit',
    props: {
      data: {
        dictionary: {
          name: 'test',
          glossLanguages: []
        },
        user: null,
        isManager: readable(true),
        about: '<p>Try editing</p>',
      },
    },
  },
]
