import type { DeprecatedVariant, Viewport } from 'kitbook'
import { readable } from 'svelte/store'
import type Component from './+page.svelte'
import { mockDictionaryLayoutData } from '$lib/mocks/layout'

export const viewports: Viewport[] = [
  { width: 600, height: 800 },
]

export const variants: DeprecatedVariant<Component>[] = [
  {
    props: {
      data: {
        ...mockDictionaryLayoutData,
        updateDictionary: null,
        remove_gloss_language: null,
        add_featured_image: (file: File) => {
          console.info('Uploading image', file)
          return readable({ progress: 25, preview_url: URL.createObjectURL(file) })
        },
      },
    },
  },
]
