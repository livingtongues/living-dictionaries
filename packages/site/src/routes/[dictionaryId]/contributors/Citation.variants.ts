import type { Variant, Viewport } from 'kitbook'
import type Component from './Citation.svelte'
import type { IDictionary } from '@living-dictionaries/types'

// optionally override your kitbook viewports for all variants in this file
export const viewports: Viewport[] = [
  { name: 'Desktop', width: 800, height: 200 },
  { name: 'Mobile', width: 320, height: 200}
]

const dictionary:IDictionary = {
  id: 'Bananga',
  glossLanguages: ['es', 'it'],
} as IDictionary

export const variants: Variant<Component>[] = [
  {
    name: 'Situation A',
    description: 'Add optional information about this variant',
    languages: [],
    props: {
      dictionary,
    },

    // optionally set viewports just for this variant
    // viewports: [
    //   { name: 'Desktop', width: 800, height: 600 },
    // ],
  },
]

// Tip: This is just a TypeScript file so you can be as creative as you want with the variants array using mock data imports, .map(), etc, to quickly create variants. If you have multiple different views that display the same data then each variants.ts file can import the same mock data to test all your views against the same use cases.
