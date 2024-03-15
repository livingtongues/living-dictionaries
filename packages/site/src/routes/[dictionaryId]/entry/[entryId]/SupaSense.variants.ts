import type { Variant, Viewport } from 'kitbook'
import type Component from './SupaSense.svelte'
import { logDbOperations } from '$lib/mocks/db'
import type { SupaSense } from '$lib/supabase/database.types'

export const viewports: Viewport[] = [{ width: 400, height: 400 }]

const defaultProps = {
  entryId: 'entry1',
  glossLanguages: ['en', 'fr', 'es'],
  ...logDbOperations,
}

const fullSense: SupaSense = {
  id: 'sense1',
  glosses: {
    en: 'to be',
    fr: 'être',
  },
  noun_class: '1',
  parts_of_speech: ['n', 'v'],
  semantic_domains: ['1.1', '2.1'],
  write_in_semantic_domains: ['dinobots', 'autobots'],
  definition: { en: 'I only show when I have a value'},
  sentences: [
    {
      id: '',
      text: { default: 'Hello' },
      translation: {
        es: 'Hola'
      }
    }
  ]
}

export const variants: Variant<Component>[] = [
  {
    props: {
      ...defaultProps,
      can_edit: true,
      sense: fullSense,
    },
  },
  {
    name: 'empty',
    props: {
      ...defaultProps,
      can_edit: true,
      sense: {
        id: 'sense1',
      },
    },
  },
  {
    name: 'cannot edit, full',
    props: {
      ...defaultProps,
      sense: fullSense,
    },
  },
  {
    name: 'cannot edit, not much',
    props: {
      ...defaultProps,
      sense: {
        id: 'sense1',
        noun_class: '1',
      },
    },
  },
]

