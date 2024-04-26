import type { DeprecatedVariant, Viewport } from 'kitbook'
import { readable } from 'svelte/store'
import type Component from './+page.svelte'
import { mockDictionaryLayoutData } from '$lib/mocks/layout'

export const viewports: Viewport[] = [
  { width: 400, height: 200 },
]
export const variants: DeprecatedVariant<Component>[] = [
  {
    name: 'View',
    props: {
      data: {
        ...mockDictionaryLayoutData,
        about: 'This language has interesting verb morphology...',
        update_about: null,
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
        update_about: null,
      },
    },
  },
]
