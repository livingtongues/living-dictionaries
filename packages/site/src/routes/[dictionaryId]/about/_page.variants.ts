import type { Variant, Viewport } from 'kitbook';
import type Component from './+page.svelte';
import { readable } from 'svelte/store';
import { mockDictionaryLayoutData } from '$lib/mocks/layout';

export const viewports: Viewport[] = [
  { width: 400, height: 200}
]
export const variants: Variant<Component>[] = [
  {
    name: 'View',
    props: {
      data: {
        ...mockDictionaryLayoutData,
        about: 'This language has interesting verb morphology...',
      },
    },
  },
  {
    name: 'Edit',
    props: {
      data: {
        ...mockDictionaryLayoutData,
        is_manager: readable(true),
        about: '<p>Try editing</p>',
      },
    },
  },
]
