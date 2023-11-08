import type { Variant, Viewport } from 'kitbook';
import type Component from './+page.svelte';
import { readable } from 'svelte/store';

export const viewports: Viewport[] = [
  { width: 400, height: 200}
]
export const variants: Variant<Component>[] = [
  {
    name: 'View',
    props: {
      data: {
        dictionary: {
          name: 'test',
          glossLanguages: []
        },
        isManager: readable(false),
        about: 'This language has interesting verb morphology...',
        user: null,
        locale: null,
        t: null,
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
        isManager: readable(true),
        about: '<p>Try editing</p>',
        user: null,
        locale: null,
        t: null,
      },
    },
  },
]
