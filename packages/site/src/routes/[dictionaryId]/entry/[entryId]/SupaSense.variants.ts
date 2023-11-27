import type { Variant, Viewport } from 'kitbook'
import type Component from './SupaSense.svelte'
import { logDbOperations } from '$lib/mocks/db'

export const viewports: Viewport[] = [{ width: 400, height: 400 }]

const defaultProps = {
  entryId: 'entry1',
  updateSense: logDbOperations.updateSense,
  glossLanguages: ['en', 'fr', 'es']
}

const fullSense = {
  id: 'sense1',
  glosses: {
    en: 'to be',
    fr: 'être',
  },
  noun_class: '1',
  parts_of_speech: ['n', 'v'],
  semantic_domains: ['1.1', '2.1'],
  write_in_semantic_domains: ['dinobots', 'autobots'],
  definition_english_deprecated: 'I only show when I have a value'
}

export const variants: Variant<Component>[] = [
  {
    props: {
      ...defaultProps,
      canEdit: true,
      sense: fullSense,
    },
  },
  {
    name: 'empty',
    props: {
      ...defaultProps,
      canEdit: true,
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

