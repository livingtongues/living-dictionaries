import type { Variant, Viewport } from 'kitbook'
import type Component from './Partnership.svelte'

// optionally override your kitbook viewports for all variants in this file
export const viewports: Viewport[] = [
  { name: 'Desktop', width: 800, height: 600 },
  { name: 'Mobile', width: 320, height: 480}
];

const dictionary = {
  id: 'bananga',
  name: 'Bananga',
  glossLanguages: ['es', 'it'],
}


export const variants: Variant<Component>[] = [
  {
    name: 'Situation A',
    description: 'Add optional information about this variant',
    languages: [],
    props: {
      dictionary,
      isContributor: true
    },
  },
]

// Tip: This is just a TypeScript file so you can be as creative as you want with the variants array using mock data imports, .map(), etc, to quickly create variants. If you have multiple different views that display the same data then each variants.ts file can import the same mock data to test all your views against the same use cases.
