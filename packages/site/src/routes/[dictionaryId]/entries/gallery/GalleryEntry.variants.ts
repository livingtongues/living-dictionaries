import type { Variant, Viewport } from 'kitbook'
import type Component from './GalleryEntry.svelte'
import { butterfly_google_storage_url } from '$lib/mocks/entries'
import type { IDictionary } from '@living-dictionaries/types'

// optionally override your kitbook viewports for all variants in this file
export const viewports: Viewport[] = [
  { name: 'Mobile', width: 320, height: 380}
]

export const languages = [];


const dictionary:IDictionary = {
  glossLanguages: ['es', 'it'],
} as IDictionary

export const variants: Variant<Component>[] = [
  {
    name: 'First gloss exists',
    description: 'Spanish should show because it is first',
    props: {
      dictionary,
      entry: {
        lexeme: 'tree',
        senses: [
          {
            glosses: {
              es: 'árbol',
              it: 'albero'
            },
            photo_files: [
              {
                specifiable_image_url: butterfly_google_storage_url,
                fb_storage_path: null,
                uid_added_by: null
              }
            ]
          }
        ]
      }
    },
  },
  {
    name: 'First gloss does not exist',
    description: 'Italian should show because Spanish it is not there',
    props: {
      dictionary,
      entry: {
        lexeme: 'lion',
        senses: [
          {
            glosses: {
              it: 'leone'
            },
            photo_files: [
              {
                specifiable_image_url: butterfly_google_storage_url,
                fb_storage_path: null,
                uid_added_by: null
              }
            ]
          }
        ]
      }
    },
  },
  {
    name: 'Very long gloss',
    description: 'Very long glosses are clamped to avoid having different card (or box) sizes',
    props: {
      dictionary,
      entry: {
        lexeme: 'Castle',
        senses: [
          {
            glosses: {
              es: 'Neque porro quisquam est qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit',
            },
            photo_files: [
              {
                specifiable_image_url: butterfly_google_storage_url,
                fb_storage_path: null,
                uid_added_by: null
              }
            ]
          }
        ]
      }
    },
  },
]

// Tip: This is just a TypeScript file so you can be as creative as you want with the variants array using mock data imports, .map(), etc, to quickly create variants. If you have multiple different views that display the same data then each variants.ts file can import the same mock data to test all your views against the same use cases.
